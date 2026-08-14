/* Emulate X11WindowType
 *
 * Copyright (C) 2020 Sergio Costas (rastersoft@gmail.com)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/* exported EmulateX11WindowType */
'use strict';
import GLib from 'gi://GLib'
import Meta from 'gi://Meta'
import * as Main from 'resource:///org/gnome/shell/ui/main.js'


class ManageWindow {
    /* This class is added to each managed window, and it's used to
       make it behave like an X11 Desktop window.

       Trusted windows will set in the title the characters @!, followed
       by the coordinates where to put the window separated by a colon, and
       ended in semicolon. After that, it can have one or more of these letters

       * B : put this window at the bottom of the screen
       * T : put this window at the top of the screen
       * D : show this window in all desktops
       * H : hide this window from window list

       Using the title is generally not a problem because the desktop windows
       doesn't have a tittle. But some other windows may have and still need to
       take advantage of this, so adding a single blank space at the end of the
       title is equivalent to @!H, and having two blank spaces at the end of the
       title is equivalent to @!HTD. This allows to take advantage of these flags
       even to decorated windows.
    */

    constructor(window, waylandClient, X11Emulator) {
        this._waylandClient = waylandClient;
        this._X11Emulator = X11Emulator;
        this._window = window;
        this._signalIDs = [];
        this.windowUnmanaged = false;
        // This signal is disconnected in `disable`, when `clearWindow()` is
        // called for each window to remove everything added.
        this._signalIDs.push(window.connect('notify::title', () => {
            this._parseTitle();
        }));
        this._parseTitle();
    }

    _moveIntoPlace() {
        if (this._moveIntoPlaceID) {
            GLib.source_remove(this._moveIntoPlaceID);
        }
        this._moveIntoPlaceID = GLib.timeout_add(GLib.PRIORITY_LOW, 250, () => {
            if (this._fixed && (this._x !== null) && (this._y !== null)) {
                this._window.move_frame(true, this._x, this._y);
            }
            this._moveIntoPlaceID = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    refreshWindowPosition() {
        this._moveIntoPlace();
    }

    disconnect() {
        for (let signalID of this._signalIDs) {
            this._window.disconnect(signalID);
        }
        if (this._moveIntoPlaceID) {
            GLib.source_remove(this._moveIntoPlaceID);
        }
        if (this._keepAtTop && !this.windowUnmanaged) {
            this._window.unmake_above();
        }
        this._window = null;
        this._waylandClient = null;
    }

    setWaylandClient(client) {
        this._waylandClient = client;
    }

    _parseTitle() {
        this._x = null;
        this._y = null;
        const keepAtTop = this._keepAtTop;
        this._keepAtTop = false;
        const showInAllDesktops = this._showInAllDesktops;
        this._showInAllDesktops = false;
        this._fixed = false;
        let title = this._window.get_title();
        if (title != null) {
            if ((title.length > 0) && (title[title.length - 1] == ' ')) {
                if ((title.length > 1) && (title[title.length - 2] == ' ')) {
                    title = '@!HTD';
                } else {
                    title = '@!H';
                }
            }
            const pos = title.search('@!');
            if (pos != -1) {
                const pos2 = title.search(';', pos);
                let coords;
                if (pos2 != -1) {
                    coords = title.substring(pos + 2, pos2).trim().split(',');
                } else {
                    coords = title.substring(pos + 2).trim().split(',');
                }
                try {
                    this._x = parseInt(coords[0]);
                    this._y = parseInt(coords[1]);
                } catch (e) {
                    console.log(`Exception ${e.message}.\n${e.stack}`);
                }
                try {
                    const extraChars = title.substring(pos + 2).trim().toUpperCase();
                    for (let char of extraChars) {
                        switch (char) {
                        case 'T':
                            this._keepAtTop = true;
                            break;
                        case 'D':
                            this._showInAllDesktops = true;
                            break;
                        }
                    }
                } catch (e) {
                    console.log(`Exception ${e.message}.\n${e.stack}`);
                }
            }
            // This string must match the one at desktopManager.js
            if (title.startsWith("Desktop Icons ")) {
                this._keepAtTop = false;
                this._fixed = true;
                try {
                    const desktopIndex = parseInt(title.substring(14).trim());
                    const desktopData = this._X11Emulator.getMonitorData(desktopIndex - 1);
                    this._x = desktopData.x + desktopData.windowMarginLeft;
                    this._y = desktopData.y + desktopData.windowMarginTop;
                } catch (e) {
                    console.log(`Exception ${e.message}.\n${e.stack}`);
                }
                this._window.set_type(Meta.WindowType.DESKTOP);
            }
            if (this._keepAtTop != keepAtTop) {
                if (this._keepAtTop) {
                    this._window.make_above();
                } else {
                    this._window.unmake_above();
                }
            }
            if (this._showInAllDesktops != showInAllDesktops) {
                if (this._showInAllDesktops) {
                    this._window.stick();
                } else {
                    this._window.unstick();
                }
            }
            this._moveIntoPlace();
        }
    }
}

export class EmulateX11WindowType {
    /*
     This class makes all the heavy lifting for emulating WindowType.
     Just make one instance of it, call enable(), and whenever a window
     that you want to give "superpowers" is mapped, add it with the
     "addWindow" method. That's all.
     */
    constructor() {
        this._windowList = [];
        this._enableRefresh = true;
        this._waylandClient = null;
        this._monitorData = [];
    }

    setMonitorData(data) {
        this._monitorData = data;
    }

    getMonitorData(idx) {
        if (idx >= this._monitorData.length) {
            return null;
        }
        return this._monitorData[idx];
    }

    setWaylandClient(client) {
        this._waylandClient = client;
        for (let window of this._windowList) {
            if (window.customJS_ding) {
                window.customJS_ding.setWaylandClient(this._waylandClient);
            }
        }
    }

    enable() {
        this._idMap = global.window_manager.connect_after('map', (obj, windowActor) => {
            let window = windowActor.get_meta_window();
            if (this._waylandClient && this._waylandClient.query_window_belongs_to(window)) {
                this.addWindow(window);
            }
        });
        this._idDestroy = global.window_manager.connect_after('destroy', (wm, windowActor) => {
            // if a window is closed, ensure that the desktop doesn't receive the focus
            let window = windowActor.get_meta_window();
            if (window && (window.get_window_type() >= Meta.WindowType.DROPDOWN_MENU)) {
                return;
            }
        });
    }

    disable() {
        if (this._activate_window_ID) {
            GLib.source_remove(this._activate_window_ID);
            this._activate_window_ID = null;
        }
        for (let window of this._windowList) {
            this._clearWindow(window);
        }
        this._windowList = [];

        // disconnect signals
        if (this._idMap) {
            global.window_manager.disconnect(this._idMap);
            this._idMap = null;
        }
        if (this._idDestroy) {
            global.window_manager.disconnect(this._idDestroy);
            this._idDestroy = null;
        }
        this.refreshWindowsPosition();
    }

    addWindow(window) {
        window.customJS_ding = new ManageWindow(window, this._waylandClient, this);
        this._windowList.push(window);
        window.customJS_ding.unmanagedID = window.connect('unmanaged', window => {
            window.customJS_ding.windowUnmanaged = true;
            this._clearWindow(window);
            this._windowList = this._windowList.filter(item => item !== window);
        });
        this.refreshWindowsPosition();
    }

    refreshWindowsPosition() {
        this._windowList.forEach(window => { window.customJS_ding.refreshWindowPosition(); });
    }

    _clearWindow(window) {
        window.disconnect(window.customJS_ding.unmanagedID);
        window.customJS_ding.disconnect();
        window.customJS_ding = null;
    }
};
