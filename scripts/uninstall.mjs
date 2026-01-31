#!/usr/bin/env zx

/**
 * VoiceNudge Uninstall Script
 * Removes VoiceNudge configuration and Hammerspoon modules
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[OK]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
};

// Paths
const HOME = homedir();
const VOICENUDGE_DIR = join(HOME, '.voicenudge');
const HAMMERSPOON_DIR = join(HOME, '.hammerspoon');
const INIT_LUA_PATH = join(HAMMERSPOON_DIR, 'init.lua');

async function uninstall() {
  console.log(`\n${colors.cyan}VoiceNudge Uninstaller${colors.reset}\n`);

  // Confirm
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question('Are you sure you want to uninstall VoiceNudge? (y/N): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'y') {
    log.info('Uninstall cancelled');
    return;
  }

  // Remove config directory
  if (existsSync(VOICENUDGE_DIR)) {
    await $`rm -rf ${VOICENUDGE_DIR}`;
    log.success('Removed ~/.voicenudge directory');
  } else {
    log.info('Config directory not found (already removed?)');
  }

  // Remove Lua symlinks
  const luaFiles = ['voicenudge.lua', 'voicenudge-menu.lua'];
  for (const file of luaFiles) {
    const filePath = join(HAMMERSPOON_DIR, file);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      log.success(`Removed ${file}`);
    }
  }

  // Clean init.lua
  if (existsSync(INIT_LUA_PATH)) {
    let content = readFileSync(INIT_LUA_PATH, 'utf8');
    const originalContent = content;

    // Remove require lines
    content = content.replace(/require\("voicenudge"\)\n?/g, '');
    content = content.replace(/require\("voicenudge-menu"\)\n?/g, '');

    // Remove any empty lines at the start
    content = content.replace(/^\n+/, '');

    if (content !== originalContent) {
      writeFileSync(INIT_LUA_PATH, content);
      log.success('Cleaned init.lua');
    }
  }

  // Reload Hammerspoon
  log.info('Reloading Hammerspoon...');
  try {
    await $`/usr/local/bin/hs -c "hs.reload()"`.quiet();
    log.success('Hammerspoon reloaded');
  } catch {
    try {
      await $`/opt/homebrew/bin/hs -c "hs.reload()"`.quiet();
      log.success('Hammerspoon reloaded');
    } catch {
      log.warn('Could not reload Hammerspoon automatically');
      log.info('Please reload manually: Hammerspoon menu > Reload Config');
    }
  }

  console.log(`\n${colors.green}VoiceNudge has been uninstalled.${colors.reset}\n`);
}

uninstall().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
