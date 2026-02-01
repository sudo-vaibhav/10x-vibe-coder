# Vibe10X

A behavioral nudge tool that reminds developers to use voice input instead of typing in coding environments.

## Why Vibe10X?

Modern AI coding tools (Cursor, Conductor, Zed, VS Code + Copilot) are optimized for conversational input. Voice-to-text is 3-5x faster than typing for giving instructions to AI agents, yet developers habitually type out of muscle memory.

Vibe10X displays a gentle reminder when you exceed a keystroke threshold, nudging you to switch to voice input.

## Requirements

- **macOS** (tested on Sonoma 14.x)
- **[Hammerspoon](https://www.hammerspoon.org/)** - Install with `brew install hammerspoon`
- **[Bun](https://bun.sh/)** - Install with `curl -fsSL https://bun.sh/install | bash`
- **Accessibility permissions** for Hammerspoon

## Installation

```bash
# Clone the repository
git clone https://github.com/vaatun/vibe10x.git
cd vibe10x

# Install dependencies
bun install

# Run interactive setup
bun run setup.mjs
```

### Global CLI (Recommended)

Install globally to use the `vibe10x` command from anywhere:

```bash
cd vibe10x
bun link
```

Now you can run from anywhere:

```bash
vibe10x              # Interactive setup
vibe10x --help       # Show all options
vibe10x --preset zen # Use a preset
vibe10x --disable    # Toggle off
```

To unlink later: `bun unlink vibe10x`

The setup wizard will guide you through:
- Keystroke threshold (default: 50)
- Inactivity reset period (default: 30s)
- App categories to monitor (Dev Tools, Communication)
- Custom apps to add
- Voice alerts (optional)
- Custom alert message

## Quick Start with Presets

```bash
# Aggressive (threshold: 30) - for breaking the typing habit
bun run setup.mjs --preset aggressive

# Relaxed (threshold: 100) - gentle reminders
bun run setup.mjs --preset relaxed

# Zen (threshold: 25, with sound) - mindful mode
bun run setup.mjs --preset zen
```

## Usage

Once installed, Vibe10X runs automatically when Hammerspoon starts.

### Menu Bar

Click the **10X** icon in your menu bar to:
- See current status and keystroke count
- Toggle Vibe10X on/off
- Manage categories (enable/disable Dev Tools, Communication)
- Add custom apps from the frontmost application
- Reset the counter
- Reload configuration

### Hotkeys (Optional)

Add to your `~/.hammerspoon/init.lua`:

```lua
-- Toggle Vibe10X with Cmd+Shift+V
hs.hotkey.bind({"cmd", "shift"}, "V", function()
    vibe10x.toggle()
end)
```

## Configuration

Edit `~/.vibe10x/config.json`:

```json
{
  "enabled": true,
  "threshold": 50,
  "resetAfterSeconds": 30,
  "alertDurationSeconds": 2,
  "alertMessage": "Use your voice!",
  "voice": {
    "enabled": false
  },
  "categories": {
    "devTools": { "enabled": true },
    "communication": { "enabled": false }
  },
  "customApps": {
    "enabled": true,
    "apps": []
  },
  "menuBar": {
    "showCount": false,
    "icon": "10X"
  }
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Master toggle |
| `threshold` | `50` | Keystrokes before alert (10-500) |
| `resetAfterSeconds` | `30` | Inactivity period to reset counter |
| `alertDurationSeconds` | `2` | How long alert displays |
| `alertMessage` | `"Use your voice!"` | Alert text |
| `voice.enabled` | `false` | Speak alert message aloud |
| `categories.devTools.enabled` | `true` | Monitor dev tools (IDEs, terminals) |
| `categories.communication.enabled` | `false` | Monitor chat apps |
| `customApps.enabled` | `true` | Enable custom app list |
| `customApps.apps` | `[]` | Custom apps to monitor |
| `menuBar.showCount` | `false` | Show live count in menu bar |
| `menuBar.icon` | `"10X"` | Menu bar icon |

### App Categories

**Dev Tools** (20 apps): Code, Code - Insiders, Cursor, Zed, Conductor, Terminal, iTerm2, Warp, Alacritty, kitty, Hyper, IntelliJ IDEA, WebStorm, PyCharm, Android Studio, Xcode, Sublime Text, Atom, Nova, BBEdit

**Communication** (8 apps): WhatsApp, Signal, Telegram, Slack, Discord, Messages, Microsoft Teams, Zoom

### Custom Apps

Add apps not in any category via the menu bar ("Categories" → "Custom Apps" → "Add Current App") or in config:

```json
{
  "customApps": {
    "enabled": true,
    "apps": ["Notion", "Bear", "Obsidian"]
  }
}
```

## CLI Reference

After running `bun link`, use the `vibe10x` command:

```bash
# Interactive setup
vibe10x

# Reconfigure
vibe10x --reconfigure

# Non-interactive with threshold
vibe10x --threshold 75

# Category management
vibe10x --enable-category devTools
vibe10x --disable-category communication
vibe10x --enable-category devTools --enable-category communication

# Presets
vibe10x --preset aggressive
vibe10x --preset relaxed
vibe10x --preset zen

# Toggle monitoring
vibe10x --enable
vibe10x --disable

# Uninstall
vibe10x --uninstall

# Help
vibe10x --help
```

Or without global install, use `bun run setup.mjs [options]` from the repo directory.

## Troubleshooting

### Alert not showing

1. **Check Accessibility permissions:**
   System Preferences → Privacy & Security → Accessibility → Hammerspoon ✓

2. **Verify config:**
   ```bash
   cat ~/.vibe10x/config.json
   ```

3. **Check Hammerspoon console:**
   - Click Hammerspoon menu bar icon → Console
   - Look for `Vibe10X:` messages

4. **Verify app name:**
   In Hammerspoon console:
   ```lua
   print(hs.application.frontmostApplication():name())
   ```

### High CPU usage

1. Reduce the number of monitored apps
2. Increase the threshold value
3. Check for conflicting Hammerspoon scripts

### Setup script fails

1. Ensure Hammerspoon is installed: `brew install hammerspoon`
2. Ensure Bun is installed: `bun --version`
3. Run with verbose: `bun run setup.mjs --verbose`

## Uninstall

```bash
vibe10x --uninstall
# or
bun run setup.mjs --uninstall
```

Or manually:
1. Delete `~/.vibe10x/`
2. Remove `vibe10x.lua` and `vibe10x-menu.lua` from `~/.hammerspoon/`
3. Remove `require("vibe10x")` from `~/.hammerspoon/init.lua`
4. Reload Hammerspoon

## How It Works

1. Vibe10X monitors keystrokes using Hammerspoon's event tap
2. Only counts in specified applications (VS Code, Cursor, etc.)
3. Ignores modifier keys (Cmd, Ctrl, Alt) and navigation keys
4. When threshold is reached, displays a non-intrusive alert
5. Counter resets after alert or after inactivity period

## Privacy

- **No data collection** - Everything stays local
- **No network requests** - Completely offline
- **Keystroke content not stored** - Only counts, never captures what you type
- **Open source** - Full code transparency

## License

MIT License - see [LICENSE](LICENSE)

## Author

Vaibhav / Vaatun Technologies

---

*Stop typing. Start talking. Code 10X faster.*
