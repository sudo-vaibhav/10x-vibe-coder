-- VoiceNudge - Behavioral nudge tool for voice input
-- https://github.com/vaatun/voicenudge

local voicenudge = {}

-- Configuration
local CONFIG_PATH = os.getenv("HOME") .. "/.voicenudge/config.json"
local DEFAULT_CONFIG = {
    enabled = true,
    threshold = 50,
    resetAfterSeconds = 30,
    alertDurationSeconds = 2,
    alertMessage = "Use your voice!",
    voice = { enabled = false },
    monitoredApps = { "Code", "Cursor", "Zed", "Conductor", "Terminal", "iTerm2", "Warp" },
    menuBar = { showCount = false, icon = "V" }
}

-- Internal state
local config = {}
local keystrokeCount = 0
local currentApp = nil
local isMonitoring = false

-- Watchers and timers
local eventTap = nil
local appWatcher = nil
local inactivityTimer = nil
local configWatcher = nil

-- Keys to ignore (navigation, function keys, etc.)
local ignoredKeyCodes = {
    [123] = true, -- left arrow
    [124] = true, -- right arrow
    [125] = true, -- down arrow
    [126] = true, -- up arrow
    [115] = true, -- home
    [119] = true, -- end
    [116] = true, -- page up
    [121] = true, -- page down
    [117] = true, -- delete forward
    [51] = true,  -- delete backward
    [53] = true,  -- escape
    [36] = true,  -- return
    [76] = true,  -- enter (numpad)
    [48] = true,  -- tab
    [122] = true, -- F1
    [120] = true, -- F2
    [99] = true,  -- F3
    [118] = true, -- F4
    [96] = true,  -- F5
    [97] = true,  -- F6
    [98] = true,  -- F7
    [100] = true, -- F8
    [101] = true, -- F9
    [109] = true, -- F10
    [103] = true, -- F11
    [111] = true, -- F12
}

-- Load JSON configuration file
local function loadConfig()
    local file = io.open(CONFIG_PATH, "r")
    if file then
        local content = file:read("*all")
        file:close()
        local ok, parsed = pcall(hs.json.decode, content)
        if ok and parsed then
            -- Merge with defaults
            for key, value in pairs(DEFAULT_CONFIG) do
                if parsed[key] == nil then
                    parsed[key] = value
                elseif type(value) == "table" and type(parsed[key]) == "table" then
                    for subkey, subvalue in pairs(value) do
                        if parsed[key][subkey] == nil then
                            parsed[key][subkey] = subvalue
                        end
                    end
                end
            end
            config = parsed
            return true
        else
            hs.printf("VoiceNudge: Failed to parse config, using defaults")
        end
    else
        hs.printf("VoiceNudge: Config not found at %s, using defaults", CONFIG_PATH)
    end
    config = DEFAULT_CONFIG
    return false
end

-- Save configuration to file
local function saveConfig()
    local dir = os.getenv("HOME") .. "/.voicenudge"
    os.execute("mkdir -p " .. dir)
    local file = io.open(CONFIG_PATH, "w")
    if file then
        file:write(hs.json.encode(config, true))
        file:close()
        return true
    end
    return false
end

-- Check if current app is in monitored list
local function isMonitoredApp(appName)
    if not appName then return false end
    for _, pattern in ipairs(config.monitoredApps) do
        if appName:find(pattern, 1, true) then
            return true
        end
    end
    return false
end

-- Reset the keystroke counter
local function resetCounter()
    keystrokeCount = 0
    -- Notify menu bar module if loaded
    if voicenudge.onCountUpdate then
        voicenudge.onCountUpdate(keystrokeCount, config.threshold)
    end
end

-- Reset inactivity timer
local function resetInactivityTimer()
    if inactivityTimer then
        inactivityTimer:stop()
    end
    inactivityTimer = hs.timer.doAfter(config.resetAfterSeconds, function()
        resetCounter()
    end)
end

-- Show the nudge alert
local function showNudge()
    -- Configure alert style
    local style = {
        strokeWidth = 0,
        strokeColor = { white = 1, alpha = 0 },
        fillColor = { white = 0.1, alpha = 0.9 },
        textColor = { white = 1, alpha = 1 },
        textFont = ".AppleSystemUIFont",
        textSize = 27,
        radius = 12,
        atScreenEdge = 0,
        fadeInDuration = 0.1,
        fadeOutDuration = 0.3,
        padding = 20
    }

    hs.alert.show(config.alertMessage, style, hs.screen.mainScreen(), config.alertDurationSeconds)

    -- Speak the alert message if voice is enabled
    if config.voice and config.voice.enabled then
        hs.task.new("/usr/bin/say", nil, {config.alertMessage}):start()
    end

    -- Reset counter after showing alert
    resetCounter()
end

-- Handle keystroke event
local function handleKeystroke(event)
    if not config.enabled then return false end
    if not isMonitoredApp(currentApp) then return false end

    -- Check for modifier keys (ignore if Cmd, Ctrl, or Option is held)
    local flags = event:getFlags()
    if flags.cmd or flags.ctrl or flags.alt then
        return false
    end

    -- Get key code and check if we should ignore it
    local keyCode = event:getKeyCode()
    if ignoredKeyCodes[keyCode] then
        return false
    end

    -- Increment counter
    keystrokeCount = keystrokeCount + 1

    -- Notify menu bar module if loaded
    if voicenudge.onCountUpdate then
        voicenudge.onCountUpdate(keystrokeCount, config.threshold)
    end

    -- Reset inactivity timer
    resetInactivityTimer()

    -- Check threshold
    if keystrokeCount >= config.threshold then
        showNudge()
    end

    return false -- Don't consume the event
end

-- Handle app focus changes
local function handleAppEvent(appName, eventType, app)
    if eventType == hs.application.watcher.activated then
        local previousApp = currentApp
        currentApp = appName

        -- Reset counter when switching away from monitored apps
        if previousApp and isMonitoredApp(previousApp) and not isMonitoredApp(currentApp) then
            resetCounter()
        end
    elseif eventType == hs.application.watcher.deactivated then
        if appName == currentApp then
            currentApp = nil
        end
    end
end

-- Start monitoring
function voicenudge.start()
    if isMonitoring then
        hs.printf("VoiceNudge: Already running")
        return
    end

    loadConfig()

    if not config.enabled then
        hs.printf("VoiceNudge: Disabled in config")
        return
    end

    -- Get current frontmost app
    local frontApp = hs.application.frontmostApplication()
    if frontApp then
        currentApp = frontApp:name()
    end

    -- Start keystroke event tap
    eventTap = hs.eventtap.new({ hs.eventtap.event.types.keyDown }, handleKeystroke)
    eventTap:start()

    -- Start app watcher
    appWatcher = hs.application.watcher.new(handleAppEvent)
    appWatcher:start()

    -- Start config file watcher for hot-reload
    local configDir = os.getenv("HOME") .. "/.voicenudge"
    configWatcher = hs.pathwatcher.new(configDir, function(paths)
        for _, path in ipairs(paths) do
            if path:find("config.json") then
                hs.printf("VoiceNudge: Config changed, reloading...")
                voicenudge.reload()
                break
            end
        end
    end)
    configWatcher:start()

    isMonitoring = true
    hs.printf("VoiceNudge: Started (threshold: %d, apps: %s)",
        config.threshold,
        table.concat(config.monitoredApps, ", "))
end

-- Stop monitoring
function voicenudge.stop()
    if eventTap then
        eventTap:stop()
        eventTap = nil
    end

    if appWatcher then
        appWatcher:stop()
        appWatcher = nil
    end

    if inactivityTimer then
        inactivityTimer:stop()
        inactivityTimer = nil
    end

    if configWatcher then
        configWatcher:stop()
        configWatcher = nil
    end

    resetCounter()
    isMonitoring = false
    hs.printf("VoiceNudge: Stopped")
end

-- Toggle enabled state
function voicenudge.toggle()
    if isMonitoring then
        voicenudge.stop()
        hs.alert.show("VoiceNudge: OFF")
    else
        config.enabled = true
        voicenudge.start()
        hs.alert.show("VoiceNudge: ON")
    end
end

-- Reload configuration
function voicenudge.reload()
    local wasMonitoring = isMonitoring
    if wasMonitoring then
        voicenudge.stop()
    end
    loadConfig()
    if wasMonitoring and config.enabled then
        voicenudge.start()
    end
    hs.printf("VoiceNudge: Configuration reloaded")
end

-- Get current status
function voicenudge.status()
    return {
        enabled = config.enabled and isMonitoring,
        count = keystrokeCount,
        threshold = config.threshold,
        app = currentApp,
        isMonitoredApp = isMonitoredApp(currentApp)
    }
end

-- Reset counter manually
function voicenudge.reset()
    resetCounter()
    hs.printf("VoiceNudge: Counter reset")
end

-- Update configuration programmatically
function voicenudge.configure(newConfig)
    for key, value in pairs(newConfig) do
        config[key] = value
    end
    saveConfig()
    voicenudge.reload()
end

-- Get current configuration
function voicenudge.getConfig()
    return config
end

-- Auto-start on load
voicenudge.start()

return voicenudge
