-- VoiceNudge Menu Bar Module
-- Provides menu bar integration for VoiceNudge

local voicenudgeMenu = {}

-- Dependencies
local voicenudge = require("voicenudge")

-- Internal state
local menuBar = nil
local config = nil

-- Update menu bar title
local function updateTitle(count, threshold)
    if not menuBar then return end

    config = voicenudge.getConfig()
    local menuBarConfig = config.menuBar or {}
    local icon = menuBarConfig.icon or "V"

    if menuBarConfig.showCount then
        menuBar:setTitle(string.format("%s %d", icon, count or 0))
    else
        menuBar:setTitle(icon)
    end
end

-- Build the menu
local function buildMenu()
    local status = voicenudge.status()
    config = voicenudge.getConfig()

    local menu = {
        {
            title = status.enabled and "Status: ON" or "Status: OFF",
            disabled = true
        },
        {
            title = string.format("Count: %d / %d", status.count, status.threshold),
            disabled = true
        },
        { title = "-" },
        {
            title = status.enabled and "Disable" or "Enable",
            fn = function() voicenudge.toggle() end
        },
        {
            title = "Reset Counter",
            fn = function() voicenudge.reset() end
        },
        {
            title = "Reload Config",
            fn = function() voicenudge.reload() end
        },
        { title = "-" },
        {
            title = "Show Status",
            fn = function()
                local s = voicenudge.status()
                hs.alert.show(string.format(
                    "VoiceNudge: %s\nCount: %d/%d\nApp: %s %s",
                    s.enabled and "ON" or "OFF",
                    s.count,
                    s.threshold,
                    s.app or "none",
                    s.isMonitoredApp and "(monitored)" or ""
                ), 3)
            end
        },
        {
            title = "Open Config",
            fn = function()
                local configPath = os.getenv("HOME") .. "/.voicenudge/config.json"
                hs.execute("open " .. configPath)
            end
        },
        { title = "-" },
        {
            title = "Monitored Apps",
            menu = (function()
                local appMenu = {}
                for _, app in ipairs(config.monitoredApps or {}) do
                    table.insert(appMenu, { title = app, disabled = true })
                end
                return appMenu
            end)()
        }
    }

    return menu
end

-- Initialize menu bar
function voicenudgeMenu.start()
    if menuBar then
        voicenudgeMenu.stop()
    end

    config = voicenudge.getConfig()

    menuBar = hs.menubar.new()
    if menuBar then
        menuBar:setMenu(buildMenu)
        updateTitle(0, config.threshold)

        -- Register callback for count updates
        voicenudge.onCountUpdate = function(count, threshold)
            updateTitle(count, threshold)
        end

        hs.printf("VoiceNudge Menu: Started")
    end
end

-- Stop menu bar
function voicenudgeMenu.stop()
    if menuBar then
        menuBar:delete()
        menuBar = nil
    end
    voicenudge.onCountUpdate = nil
    hs.printf("VoiceNudge Menu: Stopped")
end

-- Toggle menu bar visibility
function voicenudgeMenu.toggle()
    if menuBar then
        voicenudgeMenu.stop()
    else
        voicenudgeMenu.start()
    end
end

-- Check if menu bar is active
function voicenudgeMenu.isActive()
    return menuBar ~= nil
end

-- Auto-start on load
voicenudgeMenu.start()

return voicenudgeMenu
