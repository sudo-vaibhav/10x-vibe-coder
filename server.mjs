#!/usr/bin/env bun

/**
 * Vibe10X Configuration Server
 * Local web server for the settings UI
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Paths
const HOME = homedir();
const VIBE10X_DIR = join(HOME, '.vibe10x');
const CONFIG_PATH = join(VIBE10X_DIR, 'config.json');
const CATEGORIES_PATH = join(VIBE10X_DIR, 'categories.json');
const SOURCE_CATEGORIES_PATH = join(__dirname, 'config', 'categories.json');
const DEFAULT_CONFIG_PATH = join(__dirname, 'config', 'default.json');
const WEB_DIR = join(__dirname, 'web');

const PORT = 3847;

// Ensure config directory exists
if (!existsSync(VIBE10X_DIR)) {
  mkdirSync(VIBE10X_DIR, { recursive: true });
}

// Install categories.json if missing
if (!existsSync(CATEGORIES_PATH)) {
  const categoriesContent = readFileSync(SOURCE_CATEGORIES_PATH, 'utf8');
  writeFileSync(CATEGORIES_PATH, categoriesContent);
  console.log('Installed categories.json');
}

// Load config (with defaults)
function loadConfig() {
  const defaults = JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));

  if (existsSync(CONFIG_PATH)) {
    try {
      const existing = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      return { ...defaults, ...existing };
    } catch {
      return defaults;
    }
  }
  return defaults;
}

// Save config
function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Load categories
function loadCategories() {
  if (existsSync(CATEGORIES_PATH)) {
    return JSON.parse(readFileSync(CATEGORIES_PATH, 'utf8'));
  }
  return JSON.parse(readFileSync(SOURCE_CATEGORIES_PATH, 'utf8'));
}

// Reload Hammerspoon
function reloadHammerspoon() {
  const hsPaths = ['/opt/homebrew/bin/hs', '/usr/local/bin/hs'];
  let hsPath = null;

  for (const path of hsPaths) {
    if (existsSync(path)) {
      hsPath = path;
      break;
    }
  }

  if (hsPath) {
    spawn(hsPath, ['-c', 'hs.reload()'], { stdio: 'ignore' });
    console.log('Reloaded Hammerspoon');
  }
}

// Get content type for file
function getContentType(path) {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.json')) return 'application/json';
  return 'text/plain';
}

// Request handler
async function handler(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API routes
  if (path === '/api/config') {
    if (req.method === 'GET') {
      const config = loadConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      try {
        const config = JSON.parse(body);
        saveConfig(config);
        reloadHammerspoon();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  if (path === '/api/categories' && req.method === 'GET') {
    const categories = loadCategories();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(categories));
    return;
  }

  // Static files
  let filePath = path === '/' ? '/index.html' : path;
  const fullPath = join(WEB_DIR, filePath);

  try {
    const content = readFileSync(fullPath);
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

// Create and start server
const server = createServer(handler);

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  Vibe10X Settings: ${url}\n`);

  // Open browser
  spawn('open', [url], { stdio: 'ignore' });
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close();
  process.exit(0);
});

// Keep server running
process.stdin.resume();
