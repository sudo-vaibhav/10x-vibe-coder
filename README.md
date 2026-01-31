# VoiceNudge

A behavioral nudge tool that reminds developers to use voice input instead of typing in coding environments.

## Why VoiceNudge?

Modern AI coding tools (Cursor, Conductor, Zed, VS Code + Copilot) are optimized for conversational input. Voice-to-text is 3-5x faster than typing for giving instructions to AI agents, yet developers habitually type out of muscle memory.

VoiceNudge displays a gentle reminder when you exceed a keystroke threshold, nudging you to switch to voice input.

## Requirements

- **macOS** (tested on Sonoma 14.x)
- **[Hammerspoon](https://www.hammerspoon.org/)** - Install with `brew install hammerspoon`
- **[Bun](https://bun.sh/)** - Install with `curl -fsSL https://bun.sh/install | bash`
- **Accessibility permissions** for Hammerspoon

## Installation

```bash
# Clone the repository
git clone https://github.com/vaatun/voicenudge.git
cd voicenudge

# Install dependencies
bun install

# Run interactive setup
bun run setup.mjs
```

### Global CLI (Recommended)

Install globally to use the `voicenudge` command from anywhere:

```bash
cd voicenudge
bun link
```

Now you can run from anywhere:

```bash
voicenudge              # Interactive setup
voicenudge --help       # Show all options
voicenudge --preset zen # Use a preset
voicenudge --disable    # Toggle off
```

To unlink later: `bun unlink voicenudge`

The setup wizard will guide you through:
- Keystroke threshold (default: 50)
- Inactivity reset period (default: 30s)
- Apps to monitor (VS Code, Cursor, Zed, etc.)
- Sound alerts (optional)
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

Once installed, VoiceNudge runs automatically when Hammerspoon starts.

### Menu Bar

Click the **V** icon in your menu bar to:
- See current status and keystroke count
- Toggle VoiceNudge on/off
- Reset the counter
- Reload configuration

### Hotkeys (Optional)

Add to your `~/.hammerspoon/init.lua`:

```lua
-- Toggle VoiceNudge with Cmd+Shift+V
hs.hotkey.bind({"cmd", "shift"}, "V", function()
    voicenudge.toggle()
end)
```

## Configuration

Edit `~/.voicenudge/config.json`:

```json
{
  "enabled": true,
  "threshold": 50,
  "resetAfterSeconds": 30,
  "alertDurationSeconds": 2,
  "alertMessage": "Use your voice!",
  "sound": {
    "enabled": false,
    "name": "Purr"
  },
  "monitoredApps": ["Code", "Cursor", "Zed", "Conductor"],
  "menuBar": {
    "showCount": false,
    "icon": "V"
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
| `sound.enabled` | `false` | Play sound with alert |
| `sound.name` | `"Purr"` | macOS system sound name |
| `monitoredApps` | `[...]` | Apps to monitor (partial match) |
| `menuBar.showCount` | `false` | Show live count in menu bar |
| `menuBar.icon` | `"V"` | Menu bar icon |

### Available Sounds

`Basso`, `Blow`, `Bottle`, `Frog`, `Funk`, `Glass`, `Hero`, `Morse`, `Ping`, `Pop`, `Purr`, `Sosumi`, `Submarine`, `Tink`

### Common App Names

| App | Config Value |
|-----|--------------|
| VS Code | `"Code"` |
| VS Code Insiders | `"Code - Insiders"` |
| Cursor | `"Cursor"` |
| Zed | `"Zed"` |
| Conductor | `"Conductor"` |
| Terminal | `"Terminal"` |
| iTerm2 | `"iTerm2"` |
| Warp | `"Warp"` |

## CLI Reference

After running `bun link`, use the `voicenudge` command:

```bash
# Interactive setup
voicenudge

# Reconfigure
voicenudge --reconfigure

# Non-interactive
voicenudge --threshold 75 --apps "Code,Cursor,Zed"

# Presets
voicenudge --preset aggressive
voicenudge --preset relaxed
voicenudge --preset zen

# Toggle
voicenudge --enable
voicenudge --disable

# Uninstall
voicenudge --uninstall

# Help
voicenudge --help
```

Or without global install, use `bun run setup.mjs [options]` from the repo directory.

## Troubleshooting

### Alert not showing

1. **Check Accessibility permissions:**
   System Preferences → Privacy & Security → Accessibility → Hammerspoon ✓

2. **Verify config:**
   ```bash
   cat ~/.voicenudge/config.json
   ```

3. **Check Hammerspoon console:**
   - Click Hammerspoon menu bar icon → Console
   - Look for `VoiceNudge:` messages

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
voicenudge --uninstall
# or
bun run setup.mjs --uninstall
```

Or manually:
1. Delete `~/.voicenudge/`
2. Remove `voicenudge.lua` and `voicenudge-menu.lua` from `~/.hammerspoon/`
3. Remove `require("voicenudge")` from `~/.hammerspoon/init.lua`
4. Reload Hammerspoon

## How It Works

1. VoiceNudge monitors keystrokes using Hammerspoon's event tap
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

*Stop typing. Start talking.*
