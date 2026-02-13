use std::collections::HashMap;
use std::sync::Mutex;

use serde::Deserialize;
use tauri::menu::{Menu, MenuItem, MenuItemBuilder, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

use crate::storage::read_settings;

const APP_DISPLAY_NAME: &str = "OpenVibe";

pub struct MenuItemRegistry<R: Runtime> {
    items: Mutex<HashMap<String, MenuItem<R>>>,
}

impl<R: Runtime> Default for MenuItemRegistry<R> {
    fn default() -> Self {
        Self {
            items: Mutex::new(HashMap::new()),
        }
    }
}

impl<R: Runtime> MenuItemRegistry<R> {
    fn register(&self, id: &str, item: &MenuItem<R>) {
        if let Ok(mut items) = self.items.lock() {
            items.insert(id.to_string(), item.clone());
        }
    }

    fn set_accelerator(&self, id: &str, accelerator: Option<&str>) -> tauri::Result<bool> {
        let item = match self.items.lock() {
            Ok(items) => items.get(id).cloned(),
            Err(_) => return Ok(false),
        };
        if let Some(item) = item {
            item.set_accelerator(accelerator)?;
            Ok(true)
        } else {
            Ok(false)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct MenuAcceleratorUpdate {
    pub id: String,
    pub accelerator: Option<String>,
}

#[tauri::command]
pub fn menu_set_accelerators<R: Runtime>(
    app: tauri::AppHandle<R>,
    updates: Vec<MenuAcceleratorUpdate>,
) -> Result<(), String> {
    let registry = app.state::<MenuItemRegistry<R>>();
    for update in updates {
        registry
            .set_accelerator(&update.id, update.accelerator.as_deref())
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub(crate) fn build_menu<R: tauri::Runtime>(
    handle: &tauri::AppHandle<R>,
) -> tauri::Result<Menu<R>> {
    let language = resolve_menu_language("system");
    build_menu_with_language(handle, language)
}

#[derive(Clone, Copy)]
enum MenuLanguage {
    En,
    Zh,
}

struct MenuLabels {
    about: String,
    check_updates: &'static str,
    settings: &'static str,
    quit: &'static str,
    file_menu: &'static str,
    new_agent: &'static str,
    new_worktree_agent: &'static str,
    new_clone_agent: &'static str,
    add_workspace: &'static str,
    close_window: &'static str,
    edit_menu: &'static str,
    undo: &'static str,
    redo: &'static str,
    cut: &'static str,
    copy: &'static str,
    paste: &'static str,
    select_all: &'static str,
    composer_menu: &'static str,
    cycle_model: &'static str,
    cycle_access: &'static str,
    cycle_reasoning: &'static str,
    cycle_collaboration: &'static str,
    view_menu: &'static str,
    toggle_projects_sidebar: &'static str,
    toggle_git_sidebar: &'static str,
    toggle_debug_panel: &'static str,
    toggle_terminal: &'static str,
    next_agent: &'static str,
    prev_agent: &'static str,
    next_workspace: &'static str,
    prev_workspace: &'static str,
    fullscreen: &'static str,
    window_menu: &'static str,
    minimize: &'static str,
    maximize: &'static str,
    help_menu: &'static str,
    about_window: String,
}

impl MenuLabels {
    fn new(language: MenuLanguage, app_name: &str) -> Self {
        match language {
            MenuLanguage::Zh => Self {
                about: format!("关于 {app_name}"),
                check_updates: "检查更新...",
                settings: "设置...",
                quit: "退出",
                file_menu: "文件",
                new_agent: "新建代理",
                new_worktree_agent: "新建工作树代理",
                new_clone_agent: "新建克隆代理",
                add_workspace: "添加工作区...",
                close_window: "关闭窗口",
                edit_menu: "编辑",
                undo: "撤销",
                redo: "重做",
                cut: "剪切",
                copy: "复制",
                paste: "粘贴",
                select_all: "全选",
                composer_menu: "编辑器",
                cycle_model: "切换模型",
                cycle_access: "切换权限模式",
                cycle_reasoning: "切换推理模式",
                cycle_collaboration: "切换协作模式",
                view_menu: "视图",
                toggle_projects_sidebar: "切换项目侧栏",
                toggle_git_sidebar: "切换 Git 侧栏",
                toggle_debug_panel: "切换调试面板",
                toggle_terminal: "切换终端",
                next_agent: "下一个代理",
                prev_agent: "上一个代理",
                next_workspace: "下一个工作区",
                prev_workspace: "上一个工作区",
                fullscreen: "切换全屏",
                window_menu: "窗口",
                minimize: "最小化",
                maximize: "最大化",
                help_menu: "帮助",
                about_window: format!("关于 {app_name}"),
            },
            MenuLanguage::En => Self {
                about: format!("About {app_name}"),
                check_updates: "Check for Updates...",
                settings: "Settings...",
                quit: "Quit",
                file_menu: "File",
                new_agent: "New Agent",
                new_worktree_agent: "New Worktree Agent",
                new_clone_agent: "New Clone Agent",
                add_workspace: "Add Workspace...",
                close_window: "Close Window",
                edit_menu: "Edit",
                undo: "Undo",
                redo: "Redo",
                cut: "Cut",
                copy: "Copy",
                paste: "Paste",
                select_all: "Select All",
                composer_menu: "Composer",
                cycle_model: "Cycle Model",
                cycle_access: "Cycle Access Mode",
                cycle_reasoning: "Cycle Reasoning",
                cycle_collaboration: "Cycle Collaboration Mode",
                view_menu: "View",
                toggle_projects_sidebar: "Toggle Projects Sidebar",
                toggle_git_sidebar: "Toggle Git Sidebar",
                toggle_debug_panel: "Toggle Debug Panel",
                toggle_terminal: "Toggle Terminal",
                next_agent: "Next Agent",
                prev_agent: "Previous Agent",
                next_workspace: "Next Workspace",
                prev_workspace: "Previous Workspace",
                fullscreen: "Toggle Fullscreen",
                window_menu: "Window",
                minimize: "Minimize",
                maximize: "Maximize",
                help_menu: "Help",
                about_window: format!("About {app_name}"),
            },
        }
    }
}

fn resolve_menu_language(language: &str) -> MenuLanguage {
    let normalized = language.trim().to_lowercase();
    if normalized.starts_with("zh") {
        return MenuLanguage::Zh;
    }
    if normalized.starts_with("en") {
        return MenuLanguage::En;
    }
    if normalized == "system" {
        if let Ok(lang) = std::env::var("LANG") {
            if lang.to_lowercase().starts_with("zh") {
                return MenuLanguage::Zh;
            }
        }
    }
    MenuLanguage::En
}

fn resolve_menu_language_from_settings<R: Runtime>(handle: &AppHandle<R>) -> MenuLanguage {
    let data_dir = handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| ".".into()));
    let settings_path = data_dir.join("settings.json");
    match read_settings(&settings_path) {
        Ok(settings) => resolve_menu_language(&settings.language),
        Err(_) => MenuLanguage::En,
    }
}

fn build_menu_with_language<R: tauri::Runtime>(
    handle: &tauri::AppHandle<R>,
    language: MenuLanguage,
) -> tauri::Result<Menu<R>> {
    let registry = handle.state::<MenuItemRegistry<R>>();
    let app_name = APP_DISPLAY_NAME;
    let labels = MenuLabels::new(language, app_name);
    let about_item = MenuItemBuilder::with_id("about", labels.about.clone()).build(handle)?;
    let check_updates_item =
        MenuItemBuilder::with_id("check_for_updates", labels.check_updates).build(handle)?;
    let settings_item = MenuItemBuilder::with_id("file_open_settings", labels.settings)
        .accelerator("CmdOrCtrl+,")
        .build(handle)?;
    #[cfg(target_os = "macos")]
    let app_menu = Submenu::with_items(
        handle,
        app_name,
        true,
        &[
            &about_item,
            &check_updates_item,
            &settings_item,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::services(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::hide(handle, None)?,
            &PredefinedMenuItem::hide_others(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::quit(handle, Some(labels.quit))?,
        ],
    )?;
    #[cfg(not(target_os = "macos"))]
    let app_menu = Submenu::with_items(
        handle,
        app_name,
        true,
        &[
            &about_item,
            &check_updates_item,
            &settings_item,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::quit(handle, Some(labels.quit))?,
        ],
    )?;

    let new_agent_item =
        MenuItemBuilder::with_id("file_new_agent", labels.new_agent).build(handle)?;
    let new_worktree_agent_item =
        MenuItemBuilder::with_id("file_new_worktree_agent", labels.new_worktree_agent)
            .build(handle)?;
    let new_clone_agent_item =
        MenuItemBuilder::with_id("file_new_clone_agent", labels.new_clone_agent).build(handle)?;
    let add_workspace_item =
        MenuItemBuilder::with_id("file_add_workspace", labels.add_workspace).build(handle)?;

    registry.register("file_new_agent", &new_agent_item);
    registry.register("file_new_worktree_agent", &new_worktree_agent_item);
    registry.register("file_new_clone_agent", &new_clone_agent_item);

    #[cfg(target_os = "linux")]
    let file_menu = {
        let close_window_item =
            MenuItemBuilder::with_id("file_close_window", labels.close_window).build(handle)?;
        let quit_item = MenuItemBuilder::with_id("file_quit", labels.quit).build(handle)?;
        Submenu::with_items(
            handle,
            labels.file_menu,
            true,
            &[
                &new_agent_item,
                &new_worktree_agent_item,
                &new_clone_agent_item,
                &PredefinedMenuItem::separator(handle)?,
                &add_workspace_item,
                &PredefinedMenuItem::separator(handle)?,
                &close_window_item,
                &quit_item,
            ],
        )?
    };
    #[cfg(not(target_os = "linux"))]
    let file_menu = Submenu::with_items(
        handle,
        labels.file_menu,
        true,
        &[
            &new_agent_item,
            &new_worktree_agent_item,
            &new_clone_agent_item,
            &PredefinedMenuItem::separator(handle)?,
            &add_workspace_item,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::close_window(handle, Some(labels.close_window))?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::quit(handle, Some(labels.quit))?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        handle,
        labels.edit_menu,
        true,
        &[
            &PredefinedMenuItem::undo(handle, Some(labels.undo))?,
            &PredefinedMenuItem::redo(handle, Some(labels.redo))?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, Some(labels.cut))?,
            &PredefinedMenuItem::copy(handle, Some(labels.copy))?,
            &PredefinedMenuItem::paste(handle, Some(labels.paste))?,
            &PredefinedMenuItem::select_all(handle, Some(labels.select_all))?,
        ],
    )?;

    let cycle_model_item = MenuItemBuilder::with_id("composer_cycle_model", labels.cycle_model)
        .accelerator("CmdOrCtrl+Shift+M")
        .build(handle)?;
    let cycle_access_item = MenuItemBuilder::with_id("composer_cycle_access", labels.cycle_access)
        .accelerator("CmdOrCtrl+Shift+A")
        .build(handle)?;
    let cycle_reasoning_item =
        MenuItemBuilder::with_id("composer_cycle_reasoning", labels.cycle_reasoning)
            .accelerator("CmdOrCtrl+Shift+R")
            .build(handle)?;
    let cycle_collaboration_item =
        MenuItemBuilder::with_id("composer_cycle_collaboration", labels.cycle_collaboration)
            .accelerator("Shift+Tab")
            .build(handle)?;
    registry.register("composer_cycle_model", &cycle_model_item);
    registry.register("composer_cycle_access", &cycle_access_item);
    registry.register("composer_cycle_reasoning", &cycle_reasoning_item);
    registry.register("composer_cycle_collaboration", &cycle_collaboration_item);

    let composer_menu = Submenu::with_items(
        handle,
        labels.composer_menu,
        true,
        &[
            &cycle_model_item,
            &cycle_access_item,
            &cycle_reasoning_item,
            &cycle_collaboration_item,
        ],
    )?;

    let toggle_projects_sidebar_item = MenuItemBuilder::with_id(
        "view_toggle_projects_sidebar",
        labels.toggle_projects_sidebar,
    )
    .build(handle)?;
    let toggle_git_sidebar_item =
        MenuItemBuilder::with_id("view_toggle_git_sidebar", labels.toggle_git_sidebar)
            .build(handle)?;
    let toggle_debug_panel_item =
        MenuItemBuilder::with_id("view_toggle_debug_panel", labels.toggle_debug_panel)
            .accelerator("CmdOrCtrl+Shift+D")
            .build(handle)?;
    let toggle_terminal_item =
        MenuItemBuilder::with_id("view_toggle_terminal", labels.toggle_terminal)
            .accelerator("CmdOrCtrl+Shift+T")
            .build(handle)?;
    let next_agent_item =
        MenuItemBuilder::with_id("view_next_agent", labels.next_agent).build(handle)?;
    let prev_agent_item =
        MenuItemBuilder::with_id("view_prev_agent", labels.prev_agent).build(handle)?;
    let next_workspace_item =
        MenuItemBuilder::with_id("view_next_workspace", labels.next_workspace).build(handle)?;
    let prev_workspace_item =
        MenuItemBuilder::with_id("view_prev_workspace", labels.prev_workspace).build(handle)?;
    registry.register(
        "view_toggle_projects_sidebar",
        &toggle_projects_sidebar_item,
    );
    registry.register("view_toggle_git_sidebar", &toggle_git_sidebar_item);
    registry.register("view_toggle_debug_panel", &toggle_debug_panel_item);
    registry.register("view_toggle_terminal", &toggle_terminal_item);
    registry.register("view_next_agent", &next_agent_item);
    registry.register("view_prev_agent", &prev_agent_item);
    registry.register("view_next_workspace", &next_workspace_item);
    registry.register("view_prev_workspace", &prev_workspace_item);

    #[cfg(target_os = "linux")]
    let view_menu = {
        let fullscreen_item =
            MenuItemBuilder::with_id("view_fullscreen", labels.fullscreen).build(handle)?;
        Submenu::with_items(
            handle,
            labels.view_menu,
            true,
            &[
                &toggle_projects_sidebar_item,
                &toggle_git_sidebar_item,
                &PredefinedMenuItem::separator(handle)?,
                &toggle_debug_panel_item,
                &toggle_terminal_item,
                &PredefinedMenuItem::separator(handle)?,
                &next_agent_item,
                &prev_agent_item,
                &next_workspace_item,
                &prev_workspace_item,
                &PredefinedMenuItem::separator(handle)?,
                &fullscreen_item,
            ],
        )?
    };
    #[cfg(not(target_os = "linux"))]
    let view_menu = Submenu::with_items(
        handle,
        labels.view_menu,
        true,
        &[
            &toggle_projects_sidebar_item,
            &toggle_git_sidebar_item,
            &PredefinedMenuItem::separator(handle)?,
            &toggle_debug_panel_item,
            &toggle_terminal_item,
            &PredefinedMenuItem::separator(handle)?,
            &next_agent_item,
            &prev_agent_item,
            &next_workspace_item,
            &prev_workspace_item,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::fullscreen(handle, Some(labels.fullscreen))?,
        ],
    )?;

    #[cfg(target_os = "linux")]
    let window_menu = {
        let minimize_item =
            MenuItemBuilder::with_id("window_minimize", labels.minimize).build(handle)?;
        let maximize_item =
            MenuItemBuilder::with_id("window_maximize", labels.maximize).build(handle)?;
        let close_item =
            MenuItemBuilder::with_id("window_close", labels.close_window).build(handle)?;
        Submenu::with_items(
            handle,
            labels.window_menu,
            true,
            &[
                &minimize_item,
                &maximize_item,
                &PredefinedMenuItem::separator(handle)?,
                &close_item,
            ],
        )?
    };
    #[cfg(not(target_os = "linux"))]
    let window_menu = Submenu::with_items(
        handle,
        labels.window_menu,
        true,
        &[
            &PredefinedMenuItem::minimize(handle, Some(labels.minimize))?,
            &PredefinedMenuItem::maximize(handle, Some(labels.maximize))?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::close_window(handle, Some(labels.close_window))?,
        ],
    )?;

    #[cfg(target_os = "linux")]
    let help_menu = {
        let about_item =
            MenuItemBuilder::with_id("help_about", labels.about.clone()).build(handle)?;
        Submenu::with_items(handle, labels.help_menu, true, &[&about_item])?
    };
    #[cfg(not(target_os = "linux"))]
    let help_menu = Submenu::with_items(handle, labels.help_menu, true, &[])?;

    Menu::with_items(
        handle,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &composer_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ],
    )
}

pub(crate) fn apply_menu_language<R: Runtime>(
    app: &tauri::AppHandle<R>,
    language: &str,
) -> Result<(), String> {
    let menu_language = resolve_menu_language(language);
    let app_handle = app.clone();
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let result = (|| {
            let menu =
                build_menu_with_language(&app_handle, menu_language).map_err(|e| e.to_string())?;
            app_handle.set_menu(menu).map_err(|e| e.to_string())?;
            Ok(())
        })();
        let _ = tx.send(result);
    })
    .map_err(|error| error.to_string())?;
    rx.recv()
        .unwrap_or_else(|_| Err("menu update canceled".to_string()))
}

pub(crate) fn handle_menu_event<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    event: tauri::menu::MenuEvent,
) {
    match event.id().as_ref() {
        "about" | "help_about" => {
            if let Some(window) = app.get_webview_window("about") {
                let _ = window.show();
                let _ = window.set_focus();
                return;
            }
            let menu_language = resolve_menu_language_from_settings(app);
            let labels = MenuLabels::new(menu_language, APP_DISPLAY_NAME);
            let _ = WebviewWindowBuilder::new(app, "about", WebviewUrl::App("index.html".into()))
                .title(labels.about_window)
                .resizable(false)
                .inner_size(360.0, 240.0)
                .center()
                .build();
        }
        "check_for_updates" => {
            let _ = app.emit("updater-check", ());
        }
        "file_new_agent" => emit_menu_event(app, "menu-new-agent"),
        "file_new_worktree_agent" => emit_menu_event(app, "menu-new-worktree-agent"),
        "file_new_clone_agent" => emit_menu_event(app, "menu-new-clone-agent"),
        "file_add_workspace" => emit_menu_event(app, "menu-add-workspace"),
        "file_open_settings" => emit_menu_event(app, "menu-open-settings"),
        "file_close_window" | "window_close" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.close();
            }
        }
        "file_quit" => {
            app.exit(0);
        }
        "view_fullscreen" => {
            if let Some(window) = app.get_webview_window("main") {
                let is_fullscreen = window.is_fullscreen().unwrap_or(false);
                let _ = window.set_fullscreen(!is_fullscreen);
            }
        }
        "view_toggle_projects_sidebar" => emit_menu_event(app, "menu-toggle-projects-sidebar"),
        "view_toggle_git_sidebar" => emit_menu_event(app, "menu-toggle-git-sidebar"),
        "view_toggle_debug_panel" => emit_menu_event(app, "menu-toggle-debug-panel"),
        "view_toggle_terminal" => emit_menu_event(app, "menu-toggle-terminal"),
        "view_next_agent" => emit_menu_event(app, "menu-next-agent"),
        "view_prev_agent" => emit_menu_event(app, "menu-prev-agent"),
        "view_next_workspace" => emit_menu_event(app, "menu-next-workspace"),
        "view_prev_workspace" => emit_menu_event(app, "menu-prev-workspace"),
        "composer_cycle_model" => emit_menu_event(app, "menu-composer-cycle-model"),
        "composer_cycle_access" => emit_menu_event(app, "menu-composer-cycle-access"),
        "composer_cycle_reasoning" => emit_menu_event(app, "menu-composer-cycle-reasoning"),
        "composer_cycle_collaboration" => emit_menu_event(app, "menu-composer-cycle-collaboration"),
        "window_minimize" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.minimize();
            }
        }
        "window_maximize" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.maximize();
            }
        }
        _ => {}
    }
}

fn emit_menu_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, event: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit(event, ());
    } else {
        let _ = app.emit(event, ());
    }
}
