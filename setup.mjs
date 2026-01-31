#!/usr/bin/env bun

/**
 * VoiceNudge Setup Script
 * Interactive installer for VoiceNudge Hammerspoon module
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import { spawn } from 'child_process';
import {
  PRESETS,
  DEFAULT_APPS,
  applyPreset,
  clampThreshold,
  clampResetPeriod,
  clampAlertDuration,
  parseApps,
  mergeConfig,
} from './lib/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const { values: argv } = parseArgs({
  args: process.argv.slice(2),
  options: {
    reconfigure: { type: 'boolean', short: 'r' },
    threshold: { type: 'string', short: 't' },
    apps: { type: 'string', short: 'a' },
    preset: { type: 'string', short: 'p' },
    enable: { type: 'boolean' },
    disable: { type: 'boolean' },
    uninstall: { type: 'boolean', short: 'u' },
    verbose: { type: 'boolean', short: 'v' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: false,
});

// Helper to run shell commands (tagged template literal)
function $(strings, ...values) {
  // Build command string from template literal
  let cmd = strings[0];
  for (let i = 0; i < values.length; i++) {
    cmd += values[i] + strings[i + 1];
  }

  const parts = cmd.trim().split(/\s+/);
  const [command, ...cmdArgs] = parts;

  const promise = new Promise((resolve, reject) => {
    const child = spawn(command, cmdArgs, { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data) => stdout += data);
    child.stderr?.on('data', (data) => stderr += data);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `Command failed with code ${code}`));
    });
  });

  // Add .quiet() method that returns the same promise
  promise.quiet = () => promise;
  return promise;
}

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
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
const CONFIG_PATH = join(VOICENUDGE_DIR, 'config.json');
const HAMMERSPOON_DIR = join(HOME, '.hammerspoon');
const INIT_LUA_PATH = join(HAMMERSPOON_DIR, 'init.lua');
const SOURCE_LUA_DIR = join(__dirname, 'hammerspoon');

// Parse CLI arguments
const args = {
  reconfigure: argv.reconfigure || argv.r,
  threshold: argv.threshold || argv.t,
  apps: argv.apps || argv.a,
  preset: argv.preset || argv.p,
  enable: argv.enable,
  disable: argv.disable,
  uninstall: argv.uninstall || argv.u,
  verbose: argv.verbose || argv.v,
  help: argv.help || argv.h,
};

// Show help
function showHelp() {
  console.log(`
${colors.cyan}VoiceNudge Setup${colors.reset}

A behavioral nudge tool that reminds developers to use voice input.

${colors.yellow}Usage:${colors.reset}
  voicenudge              Interactive setup
  voicenudge [options]    Non-interactive setup

${colors.yellow}Options:${colors.reset}
  -r, --reconfigure     Re-run interactive setup
  -t, --threshold N     Set keystroke threshold (10-500)
  -a, --apps "A,B,C"    Set monitored apps (comma-separated)
  -p, --preset NAME     Use preset (aggressive, relaxed, zen)
  --enable              Enable VoiceNudge
  --disable             Disable VoiceNudge
  -u, --uninstall       Remove VoiceNudge
  -v, --verbose         Show debug output
  -h, --help            Show this help

${colors.yellow}Examples:${colors.reset}
  voicenudge --preset aggressive
  voicenudge --threshold 75 --apps "Code,Cursor"
  voicenudge --disable
`);
}

// Check prerequisites
async function checkPrerequisites() {
  log.info('Checking prerequisites...');

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 18) {
    log.error(`Node.js 18+ required, found ${nodeVersion}`);
    process.exit(1);
  }
  log.success(`Node.js ${nodeVersion}`);

  // Check Hammerspoon
  const hammerspoonApp = '/Applications/Hammerspoon.app';
  const brewHammerspoon = join(HOME, '/Applications/Hammerspoon.app');

  if (!existsSync(hammerspoonApp) && !existsSync(brewHammerspoon)) {
    log.error('Hammerspoon not found. Install it with: brew install hammerspoon');
    process.exit(1);
  }
  log.success('Hammerspoon installed');

  // Check if Hammerspoon is running
  try {
    await $`pgrep -x Hammerspoon`.quiet();
    log.success('Hammerspoon is running');
  } catch {
    log.warn('Hammerspoon is not running. Please start it first.');
  }

  // Remind about Accessibility permissions
  log.info(`${colors.dim}Reminder: Hammerspoon needs Accessibility permissions${colors.reset}`);
  log.info(`${colors.dim}System Preferences > Privacy & Security > Accessibility${colors.reset}`);

  return true;
}

// Load existing config or defaults
function loadConfig() {
  const defaultConfigPath = join(__dirname, 'config', 'default.json');
  let config = JSON.parse(readFileSync(defaultConfigPath, 'utf8'));

  if (existsSync(CONFIG_PATH)) {
    try {
      const existingConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      config = { ...config, ...existingConfig };
    } catch (e) {
      log.warn('Could not parse existing config, using defaults');
    }
  }

  return config;
}

// Save config
function saveConfig(config) {
  if (!existsSync(VOICENUDGE_DIR)) {
    mkdirSync(VOICENUDGE_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  log.success(`Config saved to ${CONFIG_PATH}`);
}

// Interactive prompt helper
async function prompt(message, defaultValue = '') {
  const defaultStr = defaultValue ? ` [${defaultValue}]` : '';
  const fullPrompt = `${message}${defaultStr}: `;

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(fullPrompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

// Interactive checkbox selection
async function selectApps(currentApps) {
  console.log('\nWhich apps should VoiceNudge monitor?');
  console.log(`${colors.dim}(Enter comma-separated numbers, or 'all' for all, 'none' for none)${colors.reset}`);

  const allApps = [...new Set([...DEFAULT_APPS, ...currentApps])];

  allApps.forEach((app, i) => {
    const selected = currentApps.includes(app) ? 'x' : ' ';
    console.log(`  ${i + 1}. [${selected}] ${app}`);
  });
  console.log(`  ${allApps.length + 1}. [ ] Add custom app...`);

  const selection = await prompt('Selection', 'all');

  if (selection.toLowerCase() === 'all') {
    return allApps;
  }
  if (selection.toLowerCase() === 'none') {
    return [];
  }

  const indices = selection.split(',').map(s => parseInt(s.trim()) - 1);
  const selected = indices
    .filter(i => i >= 0 && i < allApps.length)
    .map(i => allApps[i]);

  // Check for custom app option
  if (indices.includes(allApps.length)) {
    const customApp = await prompt('Enter custom app name');
    if (customApp) {
      selected.push(customApp);
    }
  }

  return selected.length > 0 ? selected : currentApps;
}

// Interactive setup
async function interactiveSetup() {
  console.log(`\n${colors.cyan}VoiceNudge Setup${colors.reset}\n`);

  let config = loadConfig();

  // Threshold
  const thresholdInput = await prompt('Keystroke threshold (10-500)', String(config.threshold));
  config.threshold = clampThreshold(thresholdInput);

  // Reset period
  const resetInput = await prompt('Reset after inactivity (seconds, 5-300)', String(config.resetAfterSeconds));
  config.resetAfterSeconds = clampResetPeriod(resetInput);

  // Alert duration
  const durationInput = await prompt('Alert duration (seconds, 0.5-10)', String(config.alertDurationSeconds));
  config.alertDurationSeconds = clampAlertDuration(durationInput);

  // Apps
  config.monitoredApps = await selectApps(config.monitoredApps);

  // Voice (uses macOS say command)
  const voiceEnabled = await prompt('Enable voice alert? (speaks the message)', config.voice?.enabled ? 'y' : 'n');
  config.voice = config.voice || {};
  config.voice.enabled = voiceEnabled.toLowerCase() === 'y';

  // Alert message
  config.alertMessage = await prompt('Alert message', config.alertMessage);

  // Menu bar
  const showCount = await prompt('Show keystroke count in menu bar? (y/N)', config.menuBar?.showCount ? 'y' : 'n');
  config.menuBar = config.menuBar || {};
  config.menuBar.showCount = showCount.toLowerCase() === 'y';

  // Enable
  config.enabled = true;

  return config;
}

// Install Lua files
async function installLuaFiles() {
  log.info('Installing Hammerspoon modules...');

  // Ensure Hammerspoon directory exists
  if (!existsSync(HAMMERSPOON_DIR)) {
    mkdirSync(HAMMERSPOON_DIR, { recursive: true });
  }

  // Files to install
  const files = ['voicenudge.lua', 'voicenudge-menu.lua'];

  for (const file of files) {
    const source = join(SOURCE_LUA_DIR, file);
    const dest = join(HAMMERSPOON_DIR, file);

    // Remove existing symlink or file
    if (existsSync(dest)) {
      unlinkSync(dest);
    }

    // Create symlink
    symlinkSync(source, dest);
    log.success(`Linked ${file}`);
  }

  // Update init.lua
  const requireIpc = 'require("hs.ipc")';
  const requireLine = 'require("voicenudge")';
  const requireMenuLine = 'require("voicenudge-menu")';

  let initContent = '';
  if (existsSync(INIT_LUA_PATH)) {
    initContent = readFileSync(INIT_LUA_PATH, 'utf8');
  }

  let modified = false;

  // Add IPC module for CLI support (must be first)
  if (!initContent.includes(requireIpc)) {
    initContent = `${requireIpc}\n${initContent}`;
    modified = true;
  }

  if (!initContent.includes(requireLine)) {
    initContent = `${initContent}\n${requireLine}`;
    modified = true;
  }

  if (!initContent.includes(requireMenuLine)) {
    initContent = `${initContent}\n${requireMenuLine}`;
    modified = true;
  }

  if (modified) {
    writeFileSync(INIT_LUA_PATH, initContent);
    log.success('Updated init.lua');
  } else {
    log.info('init.lua already configured');
  }
}

// Reload Hammerspoon
async function reloadHammerspoon() {
  log.info('Reloading Hammerspoon...');

  // Find hs CLI
  const hsPaths = ['/opt/homebrew/bin/hs', '/usr/local/bin/hs'];
  let hsPath = null;

  for (const path of hsPaths) {
    if (existsSync(path)) {
      hsPath = path;
      break;
    }
  }

  if (!hsPath) {
    log.warn('Hammerspoon CLI (hs) not found.');
    log.info('Please reload manually: Click Hammerspoon icon in menu bar > Reload Config');
    return;
  }

  try {
    const child = spawn(hsPath, ['-c', 'hs.reload()'], { stdio: 'pipe' });
    await new Promise((resolve, reject) => {
      child.on('close', (code) => code === 0 ? resolve() : reject());
      child.on('error', reject);
    });
    log.success('Hammerspoon reloaded');
  } catch {
    log.warn('Could not reload Hammerspoon automatically.');
    log.info('This may be because IPC is not yet loaded. Please reload manually:');
    log.info('Click Hammerspoon icon in menu bar > Reload Config');
  }
}

// Enable/disable toggle
async function toggleEnabled(enable) {
  let config = loadConfig();
  config.enabled = enable;
  saveConfig(config);
  await reloadHammerspoon();
  log.success(`VoiceNudge ${enable ? 'enabled' : 'disabled'}`);
}

// Uninstall
async function uninstall() {
  log.info('Uninstalling VoiceNudge...');

  // Remove config directory
  if (existsSync(VOICENUDGE_DIR)) {
    await $`rm -rf ${VOICENUDGE_DIR}`;
    log.success('Removed config directory');
  }

  // Remove symlinks
  const files = ['voicenudge.lua', 'voicenudge-menu.lua'];
  for (const file of files) {
    const dest = join(HAMMERSPOON_DIR, file);
    if (existsSync(dest)) {
      unlinkSync(dest);
      log.success(`Removed ${file}`);
    }
  }

  // Clean init.lua
  if (existsSync(INIT_LUA_PATH)) {
    let content = readFileSync(INIT_LUA_PATH, 'utf8');
    content = content
      .replace(/require\("voicenudge"\)\n?/g, '')
      .replace(/require\("voicenudge-menu"\)\n?/g, '');
    writeFileSync(INIT_LUA_PATH, content);
    log.success('Cleaned init.lua');
  }

  await reloadHammerspoon();
  log.success('VoiceNudge uninstalled');
}

// Main
async function main() {
  if (args.help) {
    showHelp();
    return;
  }

  if (args.uninstall) {
    await uninstall();
    return;
  }

  if (args.enable) {
    await toggleEnabled(true);
    return;
  }

  if (args.disable) {
    await toggleEnabled(false);
    return;
  }

  // Check prerequisites
  await checkPrerequisites();

  let config;

  // Determine setup mode
  const hasNonInteractiveArgs = args.threshold || args.apps || args.preset;

  if (hasNonInteractiveArgs && !args.reconfigure) {
    // Non-interactive mode
    config = loadConfig();

    if (args.preset) {
      try {
        config = applyPreset(config, args.preset);
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    }

    if (args.threshold) {
      config.threshold = clampThreshold(args.threshold);
    }

    if (args.apps) {
      config.monitoredApps = parseApps(args.apps);
    }

    config.enabled = true;
  } else {
    // Interactive mode
    config = await interactiveSetup();
  }

  // Show config preview
  console.log(`\n${colors.cyan}Configuration:${colors.reset}`);
  console.log(`  Threshold: ${config.threshold} keystrokes`);
  console.log(`  Reset after: ${config.resetAfterSeconds}s inactivity`);
  console.log(`  Alert duration: ${config.alertDurationSeconds}s`);
  console.log(`  Message: "${config.alertMessage}"`);
  console.log(`  Voice: ${config.voice?.enabled ? 'on (speaks message)' : 'off'}`);
  console.log(`  Apps: ${config.monitoredApps.join(', ')}`);
  console.log(`  Menu bar count: ${config.menuBar?.showCount ? 'yes' : 'no'}`);

  // Install
  saveConfig(config);
  await installLuaFiles();
  await reloadHammerspoon();

  console.log(`\n${colors.green}VoiceNudge installed successfully!${colors.reset}`);
  console.log(`\n${colors.dim}Tips:`);
  console.log(`  - Edit config: ~/.voicenudge/config.json`);
  console.log(`  - Reconfigure: npx zx setup.mjs --reconfigure`);
  console.log(`  - Toggle: npx zx setup.mjs --enable/--disable`);
  console.log(`  - Uninstall: npx zx setup.mjs --uninstall${colors.reset}\n`);
}

main().catch((err) => {
  log.error(err.message);
  if (args.verbose) {
    console.error(err);
  }
  process.exit(1);
});
