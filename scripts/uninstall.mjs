#!/usr/bin/env zx

/**
 * Vibe10X Uninstall Script
 * Removes Vibe10X configuration and Hammerspoon modules
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
const VIBE10X_DIR = join(HOME, '.vibe10x');
const HAMMERSPOON_DIR = join(HOME, '.hammerspoon');
const INIT_LUA_PATH = join(HAMMERSPOON_DIR, 'init.lua');

async function uninstall() {
  console.log(`\n${colors.cyan}Vibe10X Uninstaller${colors.reset}\n`);

  // Confirm
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question('Are you sure you want to uninstall Vibe10X? (y/N): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'y') {
    log.info('Uninstall cancelled');
    return;
  }

  // Remove config directory
  if (existsSync(VIBE10X_DIR)) {
    await $`rm -rf ${VIBE10X_DIR}`;
    log.success('Removed ~/.vibe10x directory');
  } else {
    log.info('Config directory not found (already removed?)');
  }

  // Remove Lua symlinks
  const luaFiles = ['vibe10x.lua', 'vibe10x-menu.lua'];
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
    content = content.replace(/require\("vibe10x"\)\n?/g, '');
    content = content.replace(/require\("vibe10x-menu"\)\n?/g, '');

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

  console.log(`\n${colors.green}Vibe10X has been uninstalled.${colors.reset}\n`);
}

uninstall().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
