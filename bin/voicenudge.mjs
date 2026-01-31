#!/usr/bin/env bun

/**
 * VoiceNudge CLI
 * Global command-line interface for VoiceNudge
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const setupScript = join(__dirname, '..', 'setup.mjs');

// Pass all arguments to the setup script
const args = process.argv.slice(2);

const child = spawn('bun', ['run', setupScript, ...args], {
  stdio: 'inherit',
  cwd: join(__dirname, '..'),
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
