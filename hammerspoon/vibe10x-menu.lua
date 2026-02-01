-- Vibe10X Menu Bar Module
-- Provides menu bar integration for Vibe10X

local vibe10xMenu = {}

-- Dependencies
local vibe10x = require("vibe10x")

-- Internal state
local menuBar = nil
local config = nil

-- Update menu bar title
local function updateTitle(count, threshold)
    if not menuBar then return end

    config = vibe10x.getConfig()
    local menuBarConfig = config.menuBar or {}
    local icon = menuBarConfig.icon or "10X"

    if menuBarConfig.showCount then
        menuBar:setTitle(string.format("%s %d", icon, count or 0))
    else
        menuBar:setTitle(icon)
    end
end

-- Build category submenu
local function buildCategorySubmenu(categoryId, categoryInfo)
    local submenu = {}

    -- Status
    table.insert(submenu, {
        title = categoryInfo.enabled and "Enabled" or "Disabled",
        disabled = true
    })
    table.insert(submenu, {
        title = string.format("%d apps in category", categoryInfo.appCount),
        disabled = true
    })
    table.insert(submenu, { title = "-" })

    -- Toggle
    table.insert(submenu, {
        title = categoryInfo.enabled and "Disable" or "Enable",
        fn = function()
            vibe10x.toggleCategory(categoryId)
        end
    })

    -- List apps in category
    table.insert(submenu, { title = "-" })
    local CATEGORIES = vibe10x.CATEGORIES
    if CATEGORIES and CATEGORIES[categoryId] then
        for _, app in ipairs(CATEGORIES[categoryId].apps) do
            table.insert(submenu, {
                title = app,
                disabled = true
            })
        end
    end

    return submenu
end

-- Build custom apps submenu
local function buildCustomAppsSubmenu()
    local submenu = {}
    local customApps = config.customApps or { enabled = true, apps = {} }

    -- Status
    table.insert(submenu, {
        title = customApps.enabled and "Enabled" or "Disabled",
        disabled = true
    })
    table.insert(submenu, { title = "-" })

    -- Toggle
    table.insert(submenu, {
        title = customApps.enabled and "Disable Custom Apps" or "Enable Custom Apps",
        fn = function()
            vibe10x.toggleCustomApps()
        end
    })

    -- Add current app option
    table.insert(submenu, {
        title = "Add Current App...",
        fn = function()
            local frontApp = hs.application.frontmostApplication()
            if frontApp then
                local appName = frontApp:name()
                if vibe10x.addCustomApp(appName) then
                    hs.alert.show("Added: " .. appName)
                else
                    hs.alert.show("Already added: " .. appName)
                end
            end
        end
    })

    -- List custom apps with remove option
    if customApps.apps and #customApps.apps > 0 then
        table.insert(submenu, { title = "-" })
        table.insert(submenu, {
            title = "Custom Apps:",
            disabled = true
        })
        for _, app in ipairs(customApps.apps) do
            table.insert(submenu, {
                title = "  " .. app,
                menu = {
                    {
                        title = "Remove",
                        fn = function()
                            if vibe10x.removeCustomApp(app) then
                                hs.alert.show("Removed: " .. app)
                            end
                        end
                    }
                }
            })
        end
    else
        table.insert(submenu, { title = "-" })
        table.insert(submenu, {
            title = "No custom apps",
            disabled = true
        })
    end

    return submenu
end

-- Build the menu
local function buildMenu()
    local status = vibe10x.status()
    config = vibe10x.getConfig()
    local categories = status.categories or {}

    local menu = {
        {
            title = status.enabled and "Status: ON" or "Status: OFF",
            disabled = true
        },
        {
            title = string.format("Count: %d / %d", status.count, status.threshold),
            disabled = true
        },
        {
            title = string.format("Monitoring %d apps", status.monitoredAppsCount or 0),
            disabled = true
        },
        { title = "-" },
        {
            title = status.enabled and "Disable Vibe10X" or "Enable Vibe10X",
            fn = function() vibe10x.toggle() end
        },
        {
            title = "Reset Counter",
            fn = function() vibe10x.reset() end
        },
        { title = "-" },
        {
            title = "Categories",
            menu = (function()
                local catMenu = {}

                -- Dynamically build menu for all categories from CATEGORIES
                local CATEGORIES = vibe10x.CATEGORIES
                if CATEGORIES then
                    for categoryId, categoryDef in pairs(CATEGORIES) do
                        if categories[categoryId] then
                            local checkmark = categories[categoryId].enabled and "ON" or "OFF"
                            table.insert(catMenu, {
                                title = string.format("%s [%s]", categoryDef.name, checkmark),
                                menu = buildCategorySubmenu(categoryId, categories[categoryId])
                            })
                        end
                    end
                end

                table.insert(catMenu, { title = "-" })

                -- Custom apps
                local customApps = config.customApps or { enabled = true, apps = {} }
                local customCount = customApps.apps and #customApps.apps or 0
                local customCheck = customApps.enabled and "ON" or "OFF"
                table.insert(catMenu, {
                    title = string.format("Custom Apps (%d) [%s]", customCount, customCheck),
                    menu = buildCustomAppsSubmenu()
                })

                return catMenu
            end)()
        },
        { title = "-" },
        {
            title = "Show Status",
            fn = function()
                local s = vibe10x.status()
                local enabledCats = {}
                for catId, catInfo in pairs(s.categories or {}) do
                    if catInfo.enabled then
                        table.insert(enabledCats, catInfo.name)
                    end
                end
                local catsStr = #enabledCats > 0 and table.concat(enabledCats, ", ") or "none"

                hs.alert.show(string.format(
                    "Vibe10X: %s\nCount: %d/%d\nApp: %s %s\nCategories: %s\nMonitoring: %d apps",
                    s.enabled and "ON" or "OFF",
                    s.count,
                    s.threshold,
                    s.app or "none",
                    s.isMonitoredApp and "(monitored)" or "",
                    catsStr,
                    s.monitoredAppsCount or 0
                ), 4)
            end
        },
        {
            title = "Open Settings...",
            fn = function()
                -- Launch the web-based settings UI via the vibe10x CLI
                -- Try global npm/bun command first, fallback to direct server
                local result = hs.execute("which vibe10x")
                if result and result ~= "" then
                    hs.task.new("/bin/bash", nil, {"-c", "vibe10x --configure"}):start()
                else
                    -- Direct fallback: open the URL if server might be running
                    hs.execute("open http://localhost:3847")
                    hs.alert.show("Run 'vibe10x --configure' to start settings server")
                end
            end
        },
        {
            title = "Open Config File",
            fn = function()
                local configPath = os.getenv("HOME") .. "/.vibe10x/config.json"
                hs.execute("open " .. configPath)
            end
        },
        {
            title = "Reload Config",
            fn = function() vibe10x.reload() end
        }
    }

    return menu
end

-- Initialize menu bar
function vibe10xMenu.start()
    if menuBar then
        vibe10xMenu.stop()
    end

    config = vibe10x.getConfig()

    menuBar = hs.menubar.new()
    if menuBar then
        menuBar:setMenu(buildMenu)
        updateTitle(0, config.threshold)

        -- Register callback for count updates
        vibe10x.onCountUpdate = function(count, threshold)
            updateTitle(count, threshold)
        end

        hs.printf("Vibe10X Menu: Started")
    end
end

-- Stop menu bar
function vibe10xMenu.stop()
    if menuBar then
        menuBar:delete()
        menuBar = nil
    end
    vibe10x.onCountUpdate = nil
    hs.printf("Vibe10X Menu: Stopped")
end

-- Toggle menu bar visibility
function vibe10xMenu.toggle()
    if menuBar then
        vibe10xMenu.stop()
    else
        vibe10xMenu.start()
    end
end

-- Check if menu bar is active
function vibe10xMenu.isActive()
    return menuBar ~= nil
end

-- Auto-start on load
vibe10xMenu.start()

return vibe10xMenu
