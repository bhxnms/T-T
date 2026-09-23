// Tests for the port-scanning logic the launcher depends on.
//
// These run on the build host (Linux CI included), so the port helpers must stay
// free of Windows-only calls — that separation is the reason launcher/main.go
// keeps them as plain functions over net.Listen.
package main

import (
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"testing"
)

// occupy binds a port for the duration of a test and returns its number.
func occupy(t *testing.T) int {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("could not open a listener: %v", err)
	}
	t.Cleanup(func() { ln.Close() })
	return ln.Addr().(*net.TCPAddr).Port
}

func TestIsPortFree(t *testing.T) {
	if isPortFree(0) {
		t.Error("port 0 is not a usable port and must not read as free")
	}
	if isPortFree(70000) {
		t.Error("an out-of-range port must not read as free")
	}

	taken := occupy(t)
	if isPortFree(taken) {
		t.Errorf("port %d is bound by this test but read as free", taken)
	}
}

// A bound port is exactly the first-run case this launcher exists for: the
// server would exit fatally on it, so the scan has to skip past it.
func TestFindFreePortSkipsOccupied(t *testing.T) {
	taken := occupy(t)

	found := findFreePort(taken, 5)
	if found == 0 {
		t.Fatal("a free port exists right after the occupied one but none was found")
	}
	if found == taken {
		t.Fatalf("returned the occupied port %d", taken)
	}
	if found <= taken {
		t.Errorf("expected a port above %d, got %d", taken, found)
	}
	// The first free one, not a random later one: a user who is told "3002"
	// should be able to predict it.
	if found != taken+1 {
		t.Errorf("expected %d (the next port), got %d", taken+1, found)
	}
}

// The whole window occupied must report failure rather than invent a port.
func TestFindFreePortGivesUpWhenWindowIsFull(t *testing.T) {
	first := occupy(t)
	// Only a 1-wide window, and that one port is held.
	if got := findFreePort(first, 1); got != 0 {
		t.Errorf("expected 0 when the only candidate is taken, got %d", got)
	}
}

func TestReadPinnedPort(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "tt-port.json")

	if _, ok := readPinnedPort(file); ok {
		t.Error("a missing file must not report a pinned port")
	}

	cases := []struct {
		name    string
		body    string
		want    int
		wantOK  bool
		comment string
	}{
		{"valid", `{"port": 8080}`, 8080, true, ""},
		{"string port", `{"port": "8080"}`, 0, false, "a hand-edited string must not be trusted"},
		{"float port", `{"port": 8080.5}`, 0, false, "a non-integer must not reach the server"},
		{"too high", `{"port": 70000}`, 0, false, "the server validates 1-65535 and would abort"},
		{"zero", `{"port": 0}`, 0, false, "port 0 means 'any port' to the OS, not to the user"},
		{"negative", `{"port": -1}`, 0, false, ""},
		{"missing key", `{"other": 1}`, 0, false, ""},
		{"not json", `not json at all`, 0, false, "must not crash the launcher"},
		{"bare null", `null`, 0, false, ""},
	}
	for _, c := range cases {
		if err := os.WriteFile(file, []byte(c.body), 0o644); err != nil {
			t.Fatalf("write failed: %v", err)
		}
		got, ok := readPinnedPort(file)
		if ok != c.wantOK || got != c.want {
			t.Errorf("%s: got (%d, %v), want (%d, %v) — %s", c.name, got, ok, c.want, c.wantOK, c.comment)
		}
	}
}

// A read-only install directory must not stop the app from starting; the choice
// is simply not remembered.
func TestRememberPortIsQuietWhenUnwritable(t *testing.T) {
	dir := t.TempDir()
	// A directory where the file should be: the write cannot succeed.
	bad := filepath.Join(dir, "tt-port.json")
	if err := os.Mkdir(bad, 0o755); err != nil {
		t.Fatalf("setup failed: %v", err)
	}
	rememberPort(bad, 3005) // must not panic or exit

	file := filepath.Join(dir, "ok.json")
	rememberPort(file, 3005)
	raw, err := os.ReadFile(file)
	if err != nil {
		t.Fatalf("expected the port to be written: %v", err)
	}
	var parsed map[string]int
	if err := json.Unmarshal(raw, &parsed); err != nil {
		t.Fatalf("written file is not valid JSON: %v", err)
	}
	if parsed["port"] != 3005 {
		t.Errorf("wrote %d, want 3005", parsed["port"])
	}
	// Round-trips back through the reader the launcher uses on the next run.
	if got, ok := readPinnedPort(file); !ok || got != 3005 {
		t.Errorf("round-trip failed: got (%d, %v)", got, ok)
	}
}
