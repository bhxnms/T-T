// TT Travel Planner — Windows launcher.
//
// Double-clicking the exe runs this: pick a port, start the bundled server,
// wait for it to answer, open the browser, and take the server down when the
// window closes.
//
// Why a native launcher rather than a .cmd that just runs the server:
//
//   - Port conflicts are the common first-run failure on Windows. 3000/3001 are
//     popular neighbours (other dev servers, Hyper-V's dynamic port reservations),
//     and the server treats a failed bind as fatal by design — right for a
//     container, hostile for someone who has never heard of EADDRINUSE. This
//     probes first and moves to the next free port instead of dying.
//   - A .cmd flashes a console and returns immediately if anything goes wrong
//     before the node process starts, so the failure scrolls away unseen.
//
// The console window is deliberately NOT hidden (-H=windowsgui is not used):
// the first run prints the generated admin password there, and that is the only
// place it appears. Hiding it would lock the user out of their own instance.
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

const (
	// defaultPort matches the server's own default, so a fresh install and a
	// hand-configured one agree on where the app lives.
	defaultPort = 3001
	// portScanLimit bounds the search: a user whose first 20 ports are all taken
	// has a bigger problem than this launcher can paper over.
	portScanLimit = 20
	// readyTimeout covers first-run database migration, which is slow on a cold
	// disk and much slower on a spinning one.
	readyTimeout = 90 * time.Second
	readyPoll    = 500 * time.Millisecond
)

var stdout = bufio.NewWriter(os.Stdout)

func say(format string, a ...interface{}) {
	fmt.Fprintf(stdout, format+"\n", a...)
	stdout.Flush()
}

// pauseBeforeExit keeps a double-clicked window open long enough to read the
// message. Without it Explorer closes the console the instant the process ends.
func pauseBeforeExit() {
	say("")
	say("  Press Enter to close...")
	bufio.NewReader(os.Stdin).ReadString('\n')
}

func fail(message, hint string) {
	say("")
	say("  [X] %s", message)
	if hint != "" {
		say("      %s", hint)
	}
	pauseBeforeExit()
	os.Exit(1)
}

func main() {
	root, err := filepath.Abs(filepath.Dir(os.Args[0]))
	if err != nil {
		fail("Could not resolve the program directory: "+err.Error(), "")
	}
	runtimeExe := filepath.Join(root, "runtime", "node.exe")
	appServer := filepath.Join(root, "app", "server")
	entry := filepath.Join(appServer, "dist", "index.js")

	say("")
	say("  TT Travel Planner")
	say("  ----------------------------------------")

	if _, err := os.Stat(runtimeExe); err != nil {
		fail("The bundled runtime is missing (runtime\\node.exe).",
			"The download is incomplete - extract the whole folder again.")
	}
	if _, err := os.Stat(entry); err != nil {
		fail("The application files are missing (app\\server\\dist\\index.js).",
			"The download is incomplete - extract the whole folder again.")
	}

	configFile := filepath.Join(root, "tt-port.json")
	pinned, hasPinned := readPinnedPort(configFile)
	preferred := defaultPort
	if hasPinned {
		preferred = pinned
	}

	port := preferred
	if !isPortFree(port) {
		next := findFreePort(preferred+1, portScanLimit-1)
		if next == 0 {
			fail(fmt.Sprintf("Ports %d-%d are all in use.", preferred, preferred+portScanLimit-1),
				"Close whatever is using them, or set a different port in tt-port.json.")
		}
		if hasPinned {
			say("  [!] Your configured port %d was in use - using %d instead.", preferred, next)
			say("      To change it, edit tt-port.json next to this program.")
		} else {
			say("  [!] Port %d was in use - using %d instead.", preferred, next)
		}
		port = next
	} else if hasPinned {
		say("  Using your configured port %d.", port)
	}
	rememberPort(configFile, port)

	url := fmt.Sprintf("http://localhost:%d", port)
	say("  Starting on %s ...", url)
	say("")

	cmd := exec.Command(runtimeExe, "--require", "tsconfig-paths/register", "dist/index.js")
	cmd.Dir = appServer
	// PORT is what the server actually reads (app-config/derive.ts). dotenv does
	// not override an existing variable, so this wins over any .env in the folder.
	cmd.Env = append(os.Environ(), fmt.Sprintf("PORT=%d", port))
	// Share the console so the server's banner - including the one-time admin
	// password - reaches the user, and so Ctrl+C reaches both processes.
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		fail("Could not start the server: "+err.Error(), "")
	}

	exited := make(chan int, 1)
	go func() { exited <- exitCode(cmd.Wait()) }()

	// Ctrl+C: take the server down with us rather than orphaning it on the port.
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sig
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
		os.Exit(0)
	}()

	// Poll in the background; whichever finishes first decides what we print.
	ready := make(chan bool, 1)
	go func() { ready <- waitForReady(port) }()

	select {
	case code := <-exited:
		say("")
		say("  The server stopped (exit code %d).", code)
		pauseBeforeExit()
		os.Exit(1)
	case ok := <-ready:
		if ok {
			say("")
			say("  Ready - opening %s", url)
			say("")
			say("  Keep this window open while using the app.")
			say("  Press Ctrl+C (or close the window) to stop it.")
			say("")
			openBrowser(url)
		} else {
			say("")
			say("  [!] The server did not answer in time.")
			say("      It may still be starting (the first run migrates the database).")
			say("      Open %s in a moment, or check app\\server\\data\\logs for details.", url)
		}
	}

	code := <-exited
	say("")
	say("  The server stopped (exit code %d).", code)
	pauseBeforeExit()
}

func exitCode(err error) int {
	if err == nil {
		return 0
	}
	if ee, ok := err.(*exec.ExitError); ok {
		return ee.ExitCode()
	}
	return -1
}

// readPinnedPort returns the port the user pinned, and whether they pinned one.
//
// Read defensively: a hand-edited file holding a string, a float or an
// out-of-range port falls through to auto-detection rather than handing the
// server something its own validator would reject at boot.
func readPinnedPort(file string) (int, bool) {
	raw, err := os.ReadFile(file)
	if err != nil {
		return 0, false
	}
	var parsed struct {
		Port *float64 `json:"port"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil || parsed.Port == nil {
		return 0, false
	}
	port := int(*parsed.Port)
	if float64(port) != *parsed.Port || port < 1 || port > 65535 {
		return 0, false
	}
	return port, true
}

// rememberPort persists the working port so the next launch reuses it.
//
// Without this the browser bookmark breaks every time a scan lands elsewhere,
// and a pinned-but-taken port would be re-derived from scratch each launch
// instead of being reported once. Failing to write is not fatal: a read-only
// install still runs, it just forgets the choice.
func rememberPort(file string, port int) {
	payload, err := json.MarshalIndent(map[string]int{"port": port}, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(file, append(payload, '\n'), 0o644)
}

// isPortFree reports whether the port can be bound on loopback right now.
//
// Binds and releases rather than dialling: a dial only proves nothing is
// *listening*, so a socket bound but not yet accepting would read as free.
func isPortFree(port int) bool {
	if port < 1 || port > 65535 {
		return false
	}
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return false
	}
	ln.Close()
	return true
}

// findFreePort returns the first free port in [start, start+attempts), or 0.
func findFreePort(start, attempts int) int {
	for port := start; port < start+attempts && port <= 65535; port++ {
		if isPortFree(port) {
			return port
		}
	}
	return 0
}

// waitForReady polls /api/health until it answers 200.
//
// 200 rather than any response: the server answers 503 while it is still
// booting or migrating, and opening the browser on a 503 shows an error page
// for an app that is two seconds from being fine.
func waitForReady(port int) bool {
	client := &http.Client{Timeout: 2 * time.Second}
	deadline := time.Now().Add(readyTimeout)
	url := fmt.Sprintf("http://127.0.0.1:%d/api/health", port)
	for time.Now().Before(deadline) {
		resp, err := client.Get(url)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return true
			}
		}
		time.Sleep(readyPoll)
	}
	return false
}

// openBrowser hands the URL to the shell. A browser that will not open is not a
// failed launch - the address is printed either way.
//
// rundll32 rather than `cmd /c start`: `start` treats its first quoted argument
// as a window title, so a URL is silently dropped on some shells.
func openBrowser(url string) {
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}
