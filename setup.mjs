#!/usr/bin/env bun

/**
 * Vibe10X Setup Script
 * Interactive installer for Vibe10X Hammerspoon module
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import { spawn } from 'child_process';
import {
  PRESETS,
  CATEGORIES,
  applyPreset,
  clampThreshold,
  clampResetPeriod,
  clampAlertDuration,
  parseApps,
  getEnabledApps,
} from './lib/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const { values: argv } = parseArgs({
  args: process.argv.slice(2),
  options: {
    reconfigure: { type: 'boolean', short: 'r' },
    configure: { type: 'boolean', short: 'c' },
    threshold: { type: 'string', short: 't' },
    apps: { type: 'string', short: 'a' },
    preset: { type: 'string', short: 'p' },
    enable: { type: 'boolean' },
    disable: { type: 'boolean' },
    'enable-category': { type: 'string' },
    'disable-category': { type: 'string' },
    uninstall: { type: 'boolean', short: 'u' },
    verbose: { type: 'boolean', short: 'v' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: false,
});

// Helper to run shell commands (tagged template literal)
function $(strings, ...values) {
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
const VIBE10X_DIR = join(HOME, '.vibe10x');
const CONFIG_PATH = join(VIBE10X_DIR, 'config.json');
const CATEGORIES_PATH = join(VIBE10X_DIR, 'categories.json');
const SOURCE_CATEGORIES_PATH = join(__dirname, 'config', 'categories.json');
const HAMMERSPOON_DIR = join(HOME, '.hammerspoon');
const INIT_LUA_PATH = join(HAMMERSPOON_DIR, 'init.lua');
const SOURCE_LUA_DIR = join(__dirname, 'hammerspoon');

// Parse CLI arguments
const args = {
  reconfigure: argv.reconfigure || argv.r,
  configure: argv.configure || argv.c,
  threshold: argv.threshold || argv.t,
  apps: argv.apps || argv.a,
  preset: argv.preset || argv.p,
  enable: argv.enable,
  disable: argv.disable,
  enableCategory: argv['enable-category'],
  disableCategory: argv['disable-category'],
  uninstall: argv.uninstall || argv.u,
  verbose: argv.verbose || argv.v,
  help: argv.help || argv.h,
};

// Build categories help text dynamically
function getCategoriesHelp() {
  const lines = [];
  for (const [id, cat] of Object.entries(CATEGORIES)) {
    const paddedId = id.padEnd(13);
    lines.push(`  ${paddedId} - ${cat.description} (${cat.apps.length} apps)`);
  }
  return lines.join('\n');
}

// Show help
function showHelp() {
  console.log(`
${colors.cyan}Vibe10X Setup${colors.reset}

A behavioral nudge tool that reminds developers to use voice input.

${colors.yellow}Usage:${colors.reset}
  vibe10x              Interactive setup
  vibe10x [options]    Non-interactive setup

${colors.yellow}Options:${colors.reset}
  -c, --configure            Open web-based settings UI
  -r, --reconfigure          Re-run interactive CLI setup
  -t, --threshold N          Set keystroke threshold (10-500)
  -a, --apps "A,B,C"         Add custom apps (comma-separated)
  -p, --preset NAME          Use preset (aggressive, relaxed, zen)
  --enable                   Enable Vibe10X
  --disable                  Disable Vibe10X
  --enable-category NAME     Enable a category
  --disable-category NAME    Disable a category
  -u, --uninstall            Remove Vibe10X
  -v, --verbose              Show debug output
  -h, --help                 Show this help

${colors.yellow}Categories:${colors.reset}
${getCategoriesHelp()}

${colors.yellow}Examples:${colors.reset}
  vibe10x --configure
  vibe10x --preset aggressive
  vibe10x --enable-category communication
  vibe10x --enable-category aiApps
  vibe10x --threshold 75 --apps "Notion,Obsidian"
  vibe10x --disable
`);
}

// Check prerequisites
async function checkPrerequisites() {
  log.info('Checking prerequisites...');

  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 18) {
    log.error(`Node.js 18+ required, found ${nodeVersion}`);
    process.exit(1);
  }
  log.success(`Node.js ${nodeVersion}`);

  const hammerspoonApp = '/Applications/Hammerspoon.app';
  const brewHammerspoon = join(HOME, '/Applications/Hammerspoon.app');

  if (!existsSync(hammerspoonApp) && !existsSync(brewHammerspoon)) {
    log.error('Hammerspoon not found. Install it with: brew install hammerspoon');
    process.exit(1);
  }
  log.success('Hammerspoon installed');

  try {
    await $`pgrep -x Hammerspoon`.quiet();
    log.success('Hammerspoon is running');
  } catch {
    log.warn('Hammerspoon is not running. Please start it first.');
  }

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

// Save config and install categories.json
function saveConfig(config) {
  if (!existsSync(VIBE10X_DIR)) {
    mkdirSync(VIBE10X_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  log.success(`Config saved to ${CONFIG_PATH}`);

  // Also copy categories.json to ~/.vibe10x/ for Lua to read
  const categoriesContent = readFileSync(SOURCE_CATEGORIES_PATH, 'utf8');
  writeFileSync(CATEGORIES_PATH, categoriesContent);
  log.success(`Categories installed to ${CATEGORIES_PATH}`);
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

// Color cycle for category display
const categoryColors = [colors.green, colors.yellow, colors.cyan];

// Interactive category selection - dynamically handles all categories
async function selectCategories(config) {
  console.log(`\n${colors.cyan}App Categories${colors.reset}`);
  console.log(`${colors.dim}Select which categories of apps to monitor:${colors.reset}\n`);

  // Ensure categories object exists
  if (!config.categories) {
    config.categories = {};
  }

  const categoryIds = Object.keys(CATEGORIES);
  for (let i = 0; i < categoryIds.length; i++) {
    const categoryId = categoryIds[i];
    const category = CATEGORIES[categoryId];
    const color = categoryColors[i % categoryColors.length];

    // Default: devTools enabled, others disabled
    const defaultEnabled = categoryId === 'devTools';
    const currentEnabled = config.categories[categoryId]?.enabled ?? defaultEnabled;

    console.log(`  ${color}${category.name}${colors.reset} (${category.apps.length} apps)`);
    console.log(`  ${colors.dim}${category.description}${colors.reset}`);

    // Show app preview (first 5 apps or all if less than 8)
    const appsPreview = category.apps.length <= 8
      ? category.apps.join(', ')
      : `${category.apps.slice(0, 5).join(', ')}...`;
    console.log(`  ${colors.dim}Apps: ${appsPreview}${colors.reset}`);

    const input = await prompt(`Enable ${category.name}?`, currentEnabled ? 'y' : 'n');
    config.categories[categoryId] = { enabled: input.toLowerCase() === 'y' };

    console.log('');
  }

  return config;
}

// Interactive custom apps selection
async function selectCustomApps(config) {
  console.log(`\n${colors.cyan}Custom Apps${colors.reset}`);
  console.log(`${colors.dim}Add apps not included in any category:${colors.reset}\n`);

  if (!config.customApps) {
    config.customApps = { enabled: true, apps: [] };
  }

  const currentApps = config.customApps.apps || [];
  if (currentApps.length > 0) {
    console.log(`  Current custom apps: ${currentApps.join(', ')}`);
  }

  const addMore = await prompt('Add custom apps? (comma-separated, or leave empty to skip)', '');

  if (addMore) {
    const newApps = parseApps(addMore);
    config.customApps.apps = [...new Set([...currentApps, ...newApps])];
    if (newApps.length > 0) {
      log.success(`Added: ${newApps.join(', ')}`);
    }
  }

  config.customApps.enabled = config.customApps.apps.length > 0 || await prompt('Enable custom apps?', 'y') === 'y';

  return config;
}

// Interactive setup
async function interactiveSetup() {
  console.log(`\n${colors.cyan}Vibe10X Setup${colors.reset}\n`);

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

  // Categories
  config = await selectCategories(config);

  // Custom apps
  config = await selectCustomApps(config);

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

  if (!existsSync(HAMMERSPOON_DIR)) {
    mkdirSync(HAMMERSPOON_DIR, { recursive: true });
  }

  const files = ['vibe10x.lua', 'vibe10x-menu.lua'];

  for (const file of files) {
    const source = join(SOURCE_LUA_DIR, file);
    const dest = join(HAMMERSPOON_DIR, file);

    if (existsSync(dest)) {
      unlinkSync(dest);
    }

    symlinkSync(source, dest);
    log.success(`Linked ${file}`);
  }

  const requireIpc = 'require("hs.ipc")';
  const requireLine = 'require("vibe10x")';
  const requireMenuLine = 'require("vibe10x-menu")';

  let initContent = '';
  if (existsSync(INIT_LUA_PATH)) {
    initContent = readFileSync(INIT_LUA_PATH, 'utf8');
  }

  let modified = false;

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
  log.success(`Vibe10X ${enable ? 'enabled' : 'disabled'}`);
}

// Toggle category
async function toggleCategory(categoryId, enable) {
  if (!CATEGORIES[categoryId]) {
    log.error(`Unknown category: ${categoryId}. Available: ${Object.keys(CATEGORIES).join(', ')}`);
    process.exit(1);
  }

  let config = loadConfig();
  if (!config.categories) {
    config.categories = {};
  }
  config.categories[categoryId] = { enabled: enable };
  saveConfig(config);
  await reloadHammerspoon();

  const categoryName = CATEGORIES[categoryId].name;
  log.success(`${categoryName} ${enable ? 'enabled' : 'disabled'}`);
}

// Uninstall
async function uninstall() {
  log.info('Uninstalling Vibe10X...');

  if (existsSync(VIBE10X_DIR)) {
    await $`rm -rf ${VIBE10X_DIR}`;
    log.success('Removed config directory (includes config.json and categories.json)');
  }

  const files = ['vibe10x.lua', 'vibe10x-menu.lua'];
  for (const file of files) {
    const dest = join(HAMMERSPOON_DIR, file);
    if (existsSync(dest)) {
      unlinkSync(dest);
      log.success(`Removed ${file}`);
    }
  }

  if (existsSync(INIT_LUA_PATH)) {
    let content = readFileSync(INIT_LUA_PATH, 'utf8');
    content = content
      .replace(/require\("vibe10x"\)\n?/g, '')
      .replace(/require\("vibe10x-menu"\)\n?/g, '');
    writeFileSync(INIT_LUA_PATH, content);
    log.success('Cleaned init.lua');
  }

  await reloadHammerspoon();
  log.success('Vibe10X uninstalled');
}

// Get enabled categories summary
function getEnabledCategoriesSummary(config) {
  const enabled = [];
  if (config.categories) {
    for (const [id, cat] of Object.entries(config.categories)) {
      if (cat.enabled && CATEGORIES[id]) {
        enabled.push(CATEGORIES[id].name);
      }
    }
  }
  if (config.customApps?.enabled && config.customApps.apps?.length > 0) {
    enabled.push(`Custom (${config.customApps.apps.length})`);
  }
  return enabled.length > 0 ? enabled.join(', ') : 'none';
}

// Launch web-based settings UI
async function launchConfigUI() {
  log.info('Starting Vibe10X Settings UI...');

  const serverPath = join(__dirname, 'server.mjs');
  const child = spawn('bun', ['run', serverPath], {
    stdio: 'inherit',
    detached: false
  });

  // Handle process termination
  process.on('SIGINT', () => {
    child.kill('SIGINT');
    process.exit(0);
  });

  // Wait for the server process
  await new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Server exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

// Main
async function main() {
  if (args.help) {
    showHelp();
    return;
  }

  if (args.configure) {
    await launchConfigUI();
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

  if (args.enableCategory) {
    await toggleCategory(args.enableCategory, true);
    return;
  }

  if (args.disableCategory) {
    await toggleCategory(args.disableCategory, false);
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
      // Add to custom apps
      if (!config.customApps) {
        config.customApps = { enabled: true, apps: [] };
      }
      const newApps = parseApps(args.apps);
      config.customApps.apps = [...new Set([...(config.customApps.apps || []), ...newApps])];
      config.customApps.enabled = true;
    }

    config.enabled = true;
  } else {
    // Interactive mode
    config = await interactiveSetup();
  }

  // Compute monitored apps for display
  const monitoredApps = getEnabledApps(config);

  // Show config preview
  console.log(`\n${colors.cyan}Configuration:${colors.reset}`);
  console.log(`  Threshold: ${config.threshold} keystrokes`);
  console.log(`  Reset after: ${config.resetAfterSeconds}s inactivity`);
  console.log(`  Alert duration: ${config.alertDurationSeconds}s`);
  console.log(`  Message: "${config.alertMessage}"`);
  console.log(`  Voice: ${config.voice?.enabled ? 'on (speaks message)' : 'off'}`);
  console.log(`  Categories: ${getEnabledCategoriesSummary(config)}`);
  console.log(`  Monitoring: ${monitoredApps.length} apps`);
  console.log(`  Menu bar count: ${config.menuBar?.showCount ? 'yes' : 'no'}`);

  // Install
  saveConfig(config);
  await installLuaFiles();
  await reloadHammerspoon();

  console.log(`\n${colors.green}Vibe10X installed successfully!${colors.reset}`);
  console.log(`\n${colors.dim}Tips:`);
  console.log(`  - Edit config: ~/.vibe10x/config.json`);
  console.log(`  - Reconfigure: vibe10x --reconfigure`);
  console.log(`  - Toggle categories: vibe10x --enable-category communication`);
  console.log(`  - Toggle: vibe10x --enable/--disable`);
  console.log(`  - Uninstall: vibe10x --uninstall${colors.reset}\n`);
}

main().catch((err) => {
  log.error(err.message);
  if (args.verbose) {
    console.error(err);
  }
  process.exit(1);
});
