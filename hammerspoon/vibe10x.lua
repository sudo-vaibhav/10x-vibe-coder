-- Vibe10X - Behavioral nudge tool for voice input
-- https://github.com/vaatun/vibe10x

local vibe10x = {}

-- Configuration
local CONFIG_PATH = os.getenv("HOME") .. "/.vibe10x/config.json"

-- Category definitions (mirrors lib/config.js)
local CATEGORIES = {
    devTools = {
        name = "Dev Tools",
        description = "Code editors, IDEs, and terminals",
        apps = {
            "Code",
            "Code - Insiders",
            "Cursor",
            "Zed",
            "Conductor",
            "Terminal",
            "iTerm2",
            "Warp",
            "Alacritty",
            "kitty",
            "Hyper",
            "IntelliJ IDEA",
            "WebStorm",
            "PyCharm",
            "Android Studio",
            "Xcode",
            "Sublime Text",
            "Atom",
            "Nova",
            "BBEdit"
        }
    },
    communication = {
        name = "Communication",
        description = "Messaging and chat apps",
        apps = {
            "WhatsApp",
            "Signal",
            "Telegram",
            "Slack",
            "Discord",
            "Messages",
            "Microsoft Teams",
            "Zoom"
        }
    }
}

local DEFAULT_CONFIG = {
    enabled = true,
    threshold = 50,
    resetAfterSeconds = 30,
    alertDurationSeconds = 2,
    alertMessage = "Use your voice!",
    voice = { enabled = false },
    categories = {
        devTools = { enabled = true },
        communication = { enabled = false }
    },
    customApps = {
        enabled = true,
        apps = {}
    },
    menuBar = { showCount = false, icon = "10X" }
}

-- Internal state
local config = {}
local keystrokeCount = 0
local currentApp = nil
local isMonitoring = false
local monitoredAppsCache = {}

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

-- Build the list of monitored apps from enabled categories + custom apps
local function buildMonitoredAppsList()
    local apps = {}
    local seen = {}

    -- Add apps from enabled categories
    if config.categories then
        for categoryId, categoryConfig in pairs(config.categories) do
            if categoryConfig.enabled and CATEGORIES[categoryId] then
                for _, app in ipairs(CATEGORIES[categoryId].apps) do
                    if not seen[app] then
                        table.insert(apps, app)
                        seen[app] = true
                    end
                end
            end
        end
    end

    -- Add custom apps if enabled
    if config.customApps and config.customApps.enabled and config.customApps.apps then
        for _, app in ipairs(config.customApps.apps) do
            if not seen[app] then
                table.insert(apps, app)
                seen[app] = true
            end
        end
    end

    monitoredAppsCache = apps
    return apps
end

-- Get formatted list of enabled categories for logging
local function getEnabledCategoriesString()
    local enabled = {}
    if config.categories then
        for categoryId, categoryConfig in pairs(config.categories) do
            if categoryConfig.enabled and CATEGORIES[categoryId] then
                table.insert(enabled, CATEGORIES[categoryId].name)
            end
        end
    end
    if config.customApps and config.customApps.enabled and #(config.customApps.apps or {}) > 0 then
        table.insert(enabled, "Custom (" .. #config.customApps.apps .. " apps)")
    end
    if #enabled == 0 then
        return "none"
    end
    return table.concat(enabled, ", ")
end

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
            buildMonitoredAppsList()
            return true
        else
            hs.printf("Vibe10X: Failed to parse config, using defaults")
        end
    else
        hs.printf("Vibe10X: Config not found at %s, using defaults", CONFIG_PATH)
    end
    config = DEFAULT_CONFIG
    buildMonitoredAppsList()
    return false
end

-- Save configuration to file
local function saveConfig()
    local dir = os.getenv("HOME") .. "/.vibe10x"
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
    for _, pattern in ipairs(monitoredAppsCache) do
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
    if vibe10x.onCountUpdate then
        vibe10x.onCountUpdate(keystrokeCount, config.threshold)
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
    if vibe10x.onCountUpdate then
        vibe10x.onCountUpdate(keystrokeCount, config.threshold)
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
function vibe10x.start()
    if isMonitoring then
        hs.printf("Vibe10X: Already running")
        return
    end

    loadConfig()

    if not config.enabled then
        hs.printf("Vibe10X: Disabled in config")
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
    local configDir = os.getenv("HOME") .. "/.vibe10x"
    configWatcher = hs.pathwatcher.new(configDir, function(paths)
        for _, path in ipairs(paths) do
            if path:find("config.json") then
                hs.printf("Vibe10X: Config changed, reloading...")
                vibe10x.reload()
                break
            end
        end
    end)
    configWatcher:start()

    isMonitoring = true
    hs.printf("Vibe10X: Started (threshold: %d, categories: %s, apps: %d)",
        config.threshold,
        getEnabledCategoriesString(),
        #monitoredAppsCache)
end

-- Stop monitoring
function vibe10x.stop()
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
    hs.printf("Vibe10X: Stopped")
end

-- Toggle enabled state
function vibe10x.toggle()
    if isMonitoring then
        vibe10x.stop()
        hs.alert.show("Vibe10X: OFF")
    else
        config.enabled = true
        vibe10x.start()
        hs.alert.show("Vibe10X: ON")
    end
end

-- Toggle a specific category
function vibe10x.toggleCategory(categoryId)
    if not CATEGORIES[categoryId] then
        hs.printf("Vibe10X: Unknown category: %s", categoryId)
        return false
    end

    if not config.categories then
        config.categories = {}
    end
    if not config.categories[categoryId] then
        config.categories[categoryId] = { enabled = false }
    end

    config.categories[categoryId].enabled = not config.categories[categoryId].enabled
    saveConfig()
    buildMonitoredAppsList()

    local categoryName = CATEGORIES[categoryId].name
    local state = config.categories[categoryId].enabled and "ON" or "OFF"
    hs.alert.show(string.format("%s: %s", categoryName, state))
    hs.printf("Vibe10X: Category '%s' %s", categoryName, state)

    return config.categories[categoryId].enabled
end

-- Enable a specific category
function vibe10x.enableCategory(categoryId)
    if not CATEGORIES[categoryId] then return false end
    if not config.categories then config.categories = {} end
    if not config.categories[categoryId] then config.categories[categoryId] = {} end
    config.categories[categoryId].enabled = true
    saveConfig()
    buildMonitoredAppsList()
    return true
end

-- Disable a specific category
function vibe10x.disableCategory(categoryId)
    if not CATEGORIES[categoryId] then return false end
    if not config.categories then config.categories = {} end
    if not config.categories[categoryId] then config.categories[categoryId] = {} end
    config.categories[categoryId].enabled = false
    saveConfig()
    buildMonitoredAppsList()
    return true
end

-- Get category status
function vibe10x.getCategoryStatus(categoryId)
    if not CATEGORIES[categoryId] then return nil end
    return config.categories and config.categories[categoryId] and config.categories[categoryId].enabled or false
end

-- Get all categories with their status
function vibe10x.getCategories()
    local result = {}
    for categoryId, categoryDef in pairs(CATEGORIES) do
        local enabled = config.categories and config.categories[categoryId] and config.categories[categoryId].enabled or false
        result[categoryId] = {
            name = categoryDef.name,
            description = categoryDef.description,
            enabled = enabled,
            appCount = #categoryDef.apps
        }
    end
    return result
end

-- Add a custom app
function vibe10x.addCustomApp(appName)
    if not appName or appName == "" then return false end
    if not config.customApps then
        config.customApps = { enabled = true, apps = {} }
    end
    if not config.customApps.apps then
        config.customApps.apps = {}
    end

    -- Check if already exists
    for _, app in ipairs(config.customApps.apps) do
        if app == appName then
            return false
        end
    end

    table.insert(config.customApps.apps, appName)
    saveConfig()
    buildMonitoredAppsList()
    hs.printf("Vibe10X: Added custom app '%s'", appName)
    return true
end

-- Remove a custom app
function vibe10x.removeCustomApp(appName)
    if not config.customApps or not config.customApps.apps then return false end

    for i, app in ipairs(config.customApps.apps) do
        if app == appName then
            table.remove(config.customApps.apps, i)
            saveConfig()
            buildMonitoredAppsList()
            hs.printf("Vibe10X: Removed custom app '%s'", appName)
            return true
        end
    end
    return false
end

-- Toggle custom apps
function vibe10x.toggleCustomApps()
    if not config.customApps then
        config.customApps = { enabled = true, apps = {} }
    end
    config.customApps.enabled = not config.customApps.enabled
    saveConfig()
    buildMonitoredAppsList()

    local state = config.customApps.enabled and "ON" or "OFF"
    hs.alert.show(string.format("Custom Apps: %s", state))
    return config.customApps.enabled
end

-- Reload configuration
function vibe10x.reload()
    local wasMonitoring = isMonitoring
    if wasMonitoring then
        vibe10x.stop()
    end
    loadConfig()
    if wasMonitoring and config.enabled then
        vibe10x.start()
    end
    hs.printf("Vibe10X: Configuration reloaded")
end

-- Get current status
function vibe10x.status()
    return {
        enabled = config.enabled and isMonitoring,
        count = keystrokeCount,
        threshold = config.threshold,
        app = currentApp,
        isMonitoredApp = isMonitoredApp(currentApp),
        categories = vibe10x.getCategories(),
        customApps = config.customApps,
        monitoredAppsCount = #monitoredAppsCache
    }
end

-- Reset counter manually
function vibe10x.reset()
    resetCounter()
    hs.printf("Vibe10X: Counter reset")
end

-- Update configuration programmatically
function vibe10x.configure(newConfig)
    for key, value in pairs(newConfig) do
        config[key] = value
    end
    saveConfig()
    vibe10x.reload()
end

-- Get current configuration
function vibe10x.getConfig()
    return config
end

-- Get monitored apps list
function vibe10x.getMonitoredApps()
    return monitoredAppsCache
end

-- Export CATEGORIES for menu bar module
vibe10x.CATEGORIES = CATEGORIES

-- Auto-start on load
vibe10x.start()

return vibe10x
