import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const ICON_SIZE = 48;
const DOCK_MARGIN = 6;

const AppIconButton = GObject.registerClass(
class AppIconButton extends St.Button {
    constructor(app) {
        super({
            style_class: 'simple-dock-app-icon',
            reactive: true,
            can_focus: true,
            track_hover: true,
        });

        this._app = app;

        this.set_child(app.create_icon_texture(ICON_SIZE));

        this.connect('clicked', () => this._activate());
        this.connect('notify::hover', () => this._onHoverChanged());
    }

    _onHoverChanged() {
        this.ease({
            scale_x: this.hover ? 1.2 : 1.0,
            scale_y: this.hover ? 1.2 : 1.0,
            duration: 150,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _activate() {
        const windows = this._app.get_windows();
        if (windows.length > 0) {
            Main.activateWindow(windows[0]);
        } else {
            this._app.activate();
        }
    }
});

export default class SimpleDockExtension extends Extension {
    enable() {
        this._appSystem = Shell.AppSystem.get_default();

        this._buildDock();

        this._runningAppsChangedId = this._appSystem.connect(
            'app-state-changed',
            () => this._refreshIcons()
        );

        this._favoritesChangedId = global.settings.connect(
            'changed::favorite-apps',
            () => this._refreshIcons()
        );
    }

    disable() {
        if (this._runningAppsChangedId) {
            this._appSystem.disconnect(this._runningAppsChangedId);
            this._runningAppsChangedId = null;
        }
        if (this._favoritesChangedId) {
            global.settings.disconnect(this._favoritesChangedId);
            this._favoritesChangedId = null;
        }

        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }

        if (this._dockContainer) {
            Main.layoutManager.removeChrome(this._dockContainer);
            this._dockContainer.destroy();
            this._dockContainer = null;
        }
        this._dockBox = null;

        this._appSystem = null;
    }

    _buildDock() {
        this._dockBox = new St.BoxLayout({
            style_class: 'simple-dock-box',
            vertical: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
        });

        this._dockContainer = new St.Widget({
            style_class: 'simple-dock-container',
            layout_manager: new Clutter.BinLayout(),
            reactive: true,
        });
        this._dockContainer.add_child(this._dockBox);

        Main.layoutManager.addChrome(this._dockContainer, {
            affectsStruts: false,
            trackFullscreen: true,
        });

        this._refreshIcons();
        this._positionDock();

        this._monitorsChangedId = Main.layoutManager.connect(
            'monitors-changed',
            () => this._positionDock()
        );
    }

    _positionDock() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor || !this._dockContainer)
            return;

        this._dockContainer.set_position(monitor.x, monitor.y);
        this._dockContainer.set_size(monitor.width, monitor.height);

        this._dockBox.set_position(
            0,
            monitor.height - ICON_SIZE - DOCK_MARGIN * 2
        );
    }

    _refreshIcons() {
        if (!this._dockBox)
            return;

        this._dockBox.destroy_all_children();

        const favoriteIds = global.settings.get_strv('favorite-apps');
        const runningApps = this._appSystem.get_running();
        const seen = new Set();

        const addApp = (app) => {
            if (!app || seen.has(app.get_id()))
                return;
            seen.add(app.get_id());
            const icon = new AppIconButton(app);
            this._dockBox.add_child(icon);
        };

        favoriteIds.forEach(id => {
            const app = this._appSystem.lookup_app(id);
            addApp(app);
        });

        runningApps.forEach(app => addApp(app));
    }
}
