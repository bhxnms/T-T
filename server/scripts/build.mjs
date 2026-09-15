import { execFileSync } from 'node:child_process';

execFileSync('tsc', ['-p', 'tsconfig.build.json'], { stdio: 'inherit' });
console.log('[build] dist ready.');
