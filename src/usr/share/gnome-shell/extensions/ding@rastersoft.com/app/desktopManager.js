/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2019-2025 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
 * Some code from Gtk4 DING version by (C) Sundeep Mediratta (smedius@gmail.com)
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
/* exported DesktopManager */
'use strict';
const GLib = imports.gi.GLib;
const GLibUnix = imports.gi.GLibUnix;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GioUnix = imports.gi.GioUnix;
const Adw = imports.gi.Adw;
const ByteArray = imports.byteArray;

const dndClipboardUtils = imports.dndClipboardUtils;
const FileItem = imports.fileItem;
const stackItem = imports.stackItem;
const DesktopGrid = imports.desktopGrid;
const DesktopIconsUtil = imports.desktopIconsUtil;
const Prefs = imports.preferences;
const Enums = imports.enums;
const NotifyX11UnderWayland = imports.notifyX11UnderWayland;
const DBusUtils = imports.dbusUtils;
const AskRenamePopup = imports.askRenamePopup;
const ShowErrorPopup = imports.showErrorPopup;
const TemplatesScriptsManager = imports.templatesScriptsManager;
const Thumbnails = imports.thumbnails;
const FileItemMenu = imports.fileItemMenu;
const AutoAr = imports.autoAr;
const SignalManager = imports.signalManager;
const DesktopMenu = imports.desktopMenu;

const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

var DesktopManager = class {
    constructor(mainApp, dbusManager, desktopList, codePath, asDesktop, primaryIndex) {
        this.mainApp = mainApp;
        this.dbusManager = dbusManager;
        this._lastSelected = null;
        this._fileList = [];
        this._desktopMenu = new DesktopMenu.DesktopMenu(this, mainApp, dbusManager);
        this.using_X11 = Gdk.Display.get_default().constructor.$gtype.name === 'GdkX11Display';
        if (asDesktop) {
            this.mainApp.hold(); // Don't close the application if there are no desktops
            this._hold_active = true;
            if (this.using_X11) {
                let usingWayland = GLib.getenv('XDG_SESSION_TYPE') == 'wayland';
                if (usingWayland) {
                    // the system is using Wayland, but GTK is using X11!!!!!!
                    DBusUtils.extensionControl.activate_action('disableTimer', null);
                    if (Prefs.desktopSettings.get_boolean('check-x11wayland')) {
                        this._notifyX11UnderWayland = new NotifyX11UnderWayland.NotifyX11UnderWayland(doNotShowAnymore => {
                            this._notifyX11UnderWayland = null;
                            if (doNotShowAnymore) {
                                Prefs.desktopSettings.set_boolean('check-x11wayland', false);
                            }
                        });
                    }
                }
            } else {
                // if the problem is fixed and appears again, DING should show the message
                Prefs.desktopSettings.set_boolean('check-x11wayland', true);
            }
        }
        this._selectedFiles = null;
        this._clickCaptured = false;
        this._popupCounter = 0;

        this.dbusManager = dbusManager;
        this._cssColorProviderSelection = null;
        this._adwStyleManager = Adw.StyleManager.get_default();
        try {
            if (this._adwStyleManager.get_system_supports_accent_colors()) {
                this._accentColorsAvailable = true;
                this._adwStyleManager.connect('notify', (obj, spec) => {
                    if ((spec.get_name() === 'accent-color') || (spec.get_name() === 'accent-color-rgba')) {
                        this._configureSelectionColor();
                    }
                });
            }
        } catch (e) {
            console.log(`System does not support accent colors: ${e.message}\n${e.stack}`);
            this._accentColorsAvailable = false;
        }

        this._premultiplied = false;
        try {
            for (let f of Prefs.mutterSettings.get_strv('experimental-features')) {
                if (f == 'scale-monitor-framebuffer') {
                    this._premultiplied = true;
                    break;
                }
            }
        } catch (e) {
        }

        this.autoAr = new AutoAr.AutoAr(this);

        this._primaryIndex = primaryIndex;
        if (primaryIndex < desktopList.length) {
            this._primaryScreen = desktopList[primaryIndex];
        } else {
            this._primaryScreen = null;
        }
        this._clickX = 0;
        this._clickY = 0;
        this._dragList = null;
        this.dragItem = null;
        this.thumbnailLoader = new Thumbnails.ThumbnailLoader(this, codePath);
        this._codePath = codePath;
        this._asDesktop = asDesktop;
        this._desktopList = desktopList;
        this._desktops = [];
        this._desktopFilesChanged = false;
        this._readingDesktopFiles = false;
        this._desktopDir = DesktopIconsUtil.getDesktopDir();
        this.desktopFsId = this._desktopDir.query_info('id::filesystem', Gio.FileQueryInfoFlags.NONE, null).get_attribute_string('id::filesystem');
        this._updateWritableByOthers();
        this._monitorDesktopDir = this._desktopDir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        this._monitorDesktopDir.set_rate_limit(1000);
        this._monitorDesktopDir.connect('changed', (obj, file, otherFile, eventType) => this._updateDesktopIfChanged(file, otherFile, eventType));

        this._fileItemMenu = new FileItemMenu.FileItemMenu(this, mainApp);
        if (Prefs.schemaGnomeDarkSettings) {
            if (this._checkApplyDarkModeSetting()) {
                Prefs.schemaGnomeDarkSettings.connect('changed', (obj, key) => {
                    if (key === 'color-scheme') {
                        this._checkApplyDarkModeSetting();
                    }
                });
            }
        }
        this._showHidden = Prefs.gtkSettings.get_boolean('show-hidden');
        this.showDropPlace = Prefs.desktopSettings.get_boolean('show-drop-place');
        this.useNemo = Prefs.desktopSettings.get_boolean('use-nemo');
        this.showLinkEmblem = Prefs.desktopSettings.get_boolean('show-link-emblem');
        this.darkText = Prefs.desktopSettings.get_boolean('dark-text-in-labels');
        this._settingsId = Prefs.desktopSettings.connect('changed', (obj, key) => {
            if (key == 'dark-text-in-labels') {
                this.darkText = Prefs.desktopSettings.get_boolean('dark-text-in-labels');
                this._updateDesktop().catch(e => {
                    print(`Exception while updating Desktop after Dark Text changed: ${e.message}\n${e.stack}`);
                });
                return;
            }
            if (key == 'show-link-emblem') {
                this.showLinkEmblem = Prefs.desktopSettings.get_boolean('show-link-emblem');
                this._updateDesktop().catch(e => {
                    print(`Exception while updating Desktop after Show Emblems changed: ${e.message}\n${e.stack}`);
                });
                return;
            }
            if (key == 'use-nemo') {
                this.useNemo = Prefs.desktopSettings.get_boolean('use-nemo');
                return;
            }
            if (key == 'icon-size') {
                this._fileList.forEach(x => x.removeFromGrid(false));
                for (let desktop of this._desktops) {
                    desktop.resizeGrid();
                }
                this._fileList.forEach(x => x.updateIcon());
                this._placeAllFilesOnGrids(true);
                this._updateDesktop().catch(e => {
                    print(`Exception while updating Desktop after Show Emblems changed: ${e.message}\n${e.stack}`);
                });
                return;
            }
            if (key == Enums.SortOrder.ORDER) {
                if (this.keepStacked) {
                    this.doStacks(true);
                } else {
                    this.doSorts(true);
                }
                return;
            }
            if (key == 'unstackedtypes') {
                if (this.keepStacked) {
                    this.doStacks(true);
                }
                return;
            }
            if (key == 'keep-stacked') {
                this.keepStacked = Prefs.desktopSettings.get_boolean('keep-stacked');
                if (!this.keepStacked) {
                    this._unstack();
                } else {
                    this.doStacks(true);
                }
                return;
            }
            if (key == 'keep-arranged') {
                this.keepArranged = Prefs.desktopSettings.get_boolean('keep-arranged');
                if (this.keepArranged) {
                    this.doSorts(true);
                }
                return;
            }
            this.showDropPlace = Prefs.desktopSettings.get_boolean('show-drop-place');
            this._updateDesktop().catch(e => {
                print(`Exception while updating Desktop after Settings Changed: ${e.message}\n${e.stack}`);
            });
        });
        Prefs.gtkSettings.connect('changed', (obj, key) => {
            if (key == 'show-hidden') {
                this._showHidden = Prefs.gtkSettings.get_boolean('show-hidden');
                this._updateDesktop().catch(e => {
                    print(`Exception while updating Desktop after Hidden Settings Changed: ${e.message}\n${e.stack}`);
                });
            }
        });
        Prefs.nautilusSettings.connect('changed', (obj, key) => {
            if (key == 'show-image-thumbnails') {
                this._updateDesktop().catch(e => {
                    print(`Exception while updating Desktop after Nautilus Settings Changed: ${e.message}\n${e.stack}`);
                });
            }
        });
        this._gtkIconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
        this._gtkIconTheme.connect('changed', () => {
            this._updateDesktop().catch(e => {
                print(`Exception while updating Desktop after Gtk Icon Theme Change: ${e.message}\n${e.stack}`);
            });
        });
        this._volumeMonitor = Gio.VolumeMonitor.get();
        this._volumeMonitor.connect('mount-added', () => {
            this._updateDesktop().catch(e => {
                print(`Exception while updating Desktop after mount added: ${e.message}\n${e.stack}`);
            });
        });
        this._volumeMonitor.connect('mount-removed', () => {
            this._updateDesktop().catch(e => {
                print(`Exception while updating Desktop after mount removed: ${e.message}\n${e.stack}`);
            });
        });

        this.rubberBand = false;

        let cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_file(Gio.File.new_for_path(GLib.build_filenamev([codePath, 'stylesheet.css'])));
        Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_USER);
        cssProvider = undefined;
        this._configureSelectionColor();
        this._createGridWindows();

        DBusUtils.GtkVfsMetadata.connectSignalToProxy('AttributeChanged', this._metadataChanged.bind(this));
        this._allFileList = null;
        this._forcedExit = false;
        this._updateDesktop().catch(e => {
            print(`Exception while Initiating Desktop: ${e.message}\n${e.stack}`);
        });

        this._scriptsList = [];

        this.ignoreKeys = [Gdk.KEY_space, Gdk.KEY_Shift_L, Gdk.KEY_Shift_R, Gdk.KEY_Control_L, Gdk.KEY_Control_R, Gdk.KEY_Caps_Lock, Gdk.KEY_Shift_Lock, Gdk.KEY_Meta_L, Gdk.KEY_Meta_R, Gdk.KEY_Alt_L, Gdk.KEY_Alt_R, Gdk.KEY_Super_L, Gdk.KEY_Super_R, Gdk.KEY_ISO_Level3_Shift, Gdk.KEY_ISO_Level5_Shift];


        // Check if Nautilus is available
        try {
            DesktopIconsUtil.trySpawn(null, ['nautilus', '--version']);
        } catch (e) {
            this._errorWindow = new ShowErrorPopup.ShowErrorPopup(_('Nautilus File Manager not found'),
                _('The Nautilus File Manager is mandatory to work with Desktop Icons NG.'),
                true);
        }
        this._pendingDropFiles = {};
        if (this._asDesktop) {
            const signalAdd = GLibUnix.signal_add ?? GLibUnix.signal_add_full;
            this._sigtermID = signalAdd(GLib.PRIORITY_DEFAULT, 15, () => {
                GLib.source_remove(this._sigtermID);
                for (let desktop of this._desktops) {
                    desktop.destroy();
                }
                this._desktops = [];
                this._forcedExit = true;
                if (this._desktopEnumerateCancellable) {
                    this._desktopEnumerateCancellable.cancel();
                }
                if (this._hold_active) {
                    this.mainApp.release();
                    this._hold_active = false;
                }
                return false;
            });
        }
        if (this._asDesktop) {
            this._dbusAdvertiseUpdate();
        }
    }

    _metadataChanged(proxy, nameOwner, args) {
        let filepath = GLib.build_filenamev([GLib.get_home_dir(), args[1]]);
        if (this._desktopDir.get_path() === GLib.path_get_dirname(filepath)) {
            for (let fileItem of this.updateFileList()) {
                if (fileItem.path == filepath) {
                    fileItem.updatedMetadata();
                    break;
                }
            }
        }
    }

    updateFileList() {
        let updateFileList;
        if (this._allFileList && (this._allFileList.length > 0)) {
            updateFileList = this._allFileList;
        } else {
            updateFileList = this._fileList;
        }
        return updateFileList;
    }

    _dbusAdvertiseUpdate() {
        DBusUtils.extensionControl.connect('action-state-changed', (actionGroup, actionName, data) => {
            if (actionName == 'desktopGeometry') {
                this.updateGridWindows(data.recursiveUnpack());
            }
        });
        DBusUtils.extensionControl.connect('action-added', (actionGroup, actionName) => {
            // this signal allows us to know when the action is available and we can read the initial value
            if (actionName == 'desktopGeometry') {
                let data = DBusUtils.extensionControl.get_action_state('desktopGeometry');
                this.updateGridWindows(data.recursiveUnpack());
            }
        });
        // This is required to trigger the 'action-added' signal
        DBusUtils.extensionControl.list_actions();
    }

    updateGridWindows(newdesktoplist) {
        if ((newdesktoplist.length > 0) && ('primaryMonitor' in newdesktoplist[0])) {
            this._primaryIndex = newdesktoplist[0].primaryMonitor;
            console.log(`Primary screen is ${this._primaryIndex}`);
        }
        if (newdesktoplist.length == this._desktopList.length) {
            let gridschanged = [];
            for (let index = 0; index < newdesktoplist.length; index++) {
                let area = newdesktoplist[index];
                let area2 = this._desktopList[index];
                if ((area.x != area2.x) ||
                    (area.y != area2.y) ||
                    (area.width != area2.width) ||
                    (area.height != area2.height) ||
                    (area.scaleFactor !== area2.scaleFactor) ||
                    (area.monitorIndex != area2.monitorIndex)) {
                    gridschanged.push(index);
                    continue;
                }
                if ((area.marginTop != area2.marginTop) ||
                    (area.marginBottom != area2.marginBottom) ||
                    (area.marginLeft != area2.marginLeft) ||
                    (area.marginRight != area2.marginRight)) {
                    if (!gridschanged.includes(index)) {
                        gridschanged.push(index);
                    }
                }
            }
            if (gridschanged.length == 0) {
                return;
            }
        }
        this._desktopList = newdesktoplist;
        if (this._primaryIndex < this._desktopList.length) {
            this._primaryScreen = this._desktopList[this._primaryIndex];
        } else {
            this._primaryScreen = null;
        }
        this._createGridWindows();
        this._updateDesktop().catch(e => {
            console.log(`Exception while updating Desktop after Show Emblems changed: ${e.message}\n${e.stack}`);
        });
    }

    _createGridWindows() {
        this._removeAllFilesFromGrids();
        for (let desktop of this._desktops) {
            desktop.destroy();
        }
        this._desktops = [];
        for (let desktopIndex in this._desktopList) {
            console.log(`Creating desktop index ${desktopIndex}`);
            let desktop = this._desktopList[desktopIndex];
            let desktopName;
            if (this._asDesktop) {
                // this name must match the one used in emulateX11WindowType
                desktopName = `Desktop Icons ${desktop.monitorIndex + 1}`;
            } else {
                desktopName = `DING ${desktop.monitorIndex + 1}`;
            }
            this._desktops.push(new DesktopGrid.DesktopGrid(this, desktopName, desktop, this._asDesktop));
        }
    }

    _configureSelectionColor() {
        if (this._cssColorProviderSelection !== null) {
            Gtk.StyleContext.remove_provider_for_display(
                Gdk.Display.get_default(),
                this._cssColorProviderSelection
            );
        }

        try {
            if (this._accentColorsAvailable) {
                this.selectColor = this._adwStyleManager.get_accent_color_rgba();
            } else {
                const box = new Gtk.Label();
                const styleContext = box.get_style_context();
                styleContext.add_class('view');
                const [exists, color] = styleContext.lookup_color('accent_bg_color');
                if (exists)
                    this.selectColor = color;
                else
                    throw new Error('Style Context does not provide accent_bg_color');
            }
        } catch (e) {
            console.log(e.message);
            console.log('Setting default accent color to blue');
            this.selectColor = new Gdk.RGBA({
                red: 0,
                green: 0,
                blue: 0.9,
                alpha: 1.0,
            });
        }
        let cssColorDefinition =
            `@define-color desktop_icons_bg_color ${this.selectColor.to_string()};\n`;
        this._cssColorProviderSelection = new Gtk.CssProvider();
        // fix for api change Gtk 4.9
        try {
            this._cssColorProviderSelection.load_from_data(cssColorDefinition);
        } catch (e) {
            const gsizeLength = -1; // NULL terminated string
            this._cssColorProviderSelection.load_from_data(
                cssColorDefinition,
                gsizeLength
            );
        }
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            this._cssColorProviderSelection,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
    }

    _checkApplyDarkModeSetting() {
        try {
            let displayGtkSettings = Gtk.Settings.get_for_screen(Gdk.Screen.get_default());
            displayGtkSettings.gtk_application_prefer_dark_theme = Prefs.schemaGnomeDarkSettings.get_string('color-scheme') === 'prefer-dark';
            return true;
        } catch (e) {
            return false;
        }
    }

    clearFileCoordinates(fileList, dropCoordinates) {
        for (let element of fileList) {
            let file = Gio.File.new_for_uri(element);
            if (!file.is_native() || !file.query_exists(null)) {
                if (dropCoordinates != null) {
                    this._pendingDropFiles[file.get_basename()] = dropCoordinates;
                }
                continue;
            }
            let info = new Gio.FileInfo();
            info.set_attribute_string('metadata::nautilus-icon-position', '');
            if (dropCoordinates != null) {
                info.set_attribute_string('metadata::nautilus-drop-position', `${dropCoordinates[0]},${dropCoordinates[1]}`);
            }
            try {
                file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
            } catch (e) { }
        }
    }

    doMoveWithDragAndDrop(xOrigin, yOrigin, xDestination, yDestination) {
        const keepArranged = this.keepArranged || this.keepStacked;
        if (this.sortSpecialFolders && keepArranged) {
            return;
        }
        // Find the grid where the destination lies and aim towards the positive side, middle of grid to ensure drop in the grid
        for (let desktop of this._desktops) {
            const grid = desktop.getGridAt(xDestination, yDestination, true);
            if (grid !== null) {
                xDestination = grid[0] + desktop._elementWidth / 2;
                yDestination = grid[1] + desktop._elementHeight / 2;
                break;
            }
        }
        let deltaX = xDestination - xOrigin;
        let deltaY = yDestination - yOrigin;
        let fileItems = [];
        for (let item of this._fileList) {
            if (item.isSelected) {
                if (keepArranged) {
                    if (item.isSpecial) {
                        fileItems.push(item);
                        item.removeFromGrid(false);
                        let [x, y, a, b, c] = item.getCoordinates();
                        item.savedCoordinates = [x + deltaX, y + deltaY];
                    } else {
                        continue;
                    }
                } else {
                    fileItems.push(item);
                    item.removeFromGrid(false);
                    let [x, y, a, b, c] = item.getCoordinates();
                    item.savedCoordinates = [x + deltaX, y + deltaY];
                }
            }
        }
        // force to store the new coordinates
        this._addFilesToDesktop(fileItems, Enums.StoredCoordinates.OVERWRITE);
        fileItems = undefined;
        if (this.keepArranged) {
            this._updateDesktop().catch(e => {
                print(`Exception while doing move with drag and drop and keeping arranged: ${e.message}\n${e.stack}`);
            });
        }
    }

    onDragBegin(item) {
        this.dragItem = item;
    }

    onDragMotion(x, y) {
        if (this.dragItem === null) {
            for (let desktop of this._desktops) {
                desktop.refreshDrag([[0, 0]], x, y);
            }
            return;
        }
        if (this._dragList === null) {
            let itemList = this.getCurrentSelection(false);
            if (!itemList) {
                return;
            }
            let [x1, y1, x2, y2, c] = this.dragItem.getCoordinates();
            let oX = x1;
            let oY = y1;
            this._dragList = [];
            for (let item of itemList) {
                [x1, y1, x2, y2, c] = item.getCoordinates();
                this._dragList.push([x1 - oX, y1 - oY]);
            }
        }
        for (let desktop of this._desktops) {
            desktop.refreshDrag(this._dragList, x, y);
        }
    }

    onDragLeave() {
        this._dragList = null;
        for (let desktop of this._desktops) {
            desktop.refreshDrag(null, 0, 0);
        }
    }

    onDragEnd() {
        this.dragItem = null;
    }

    onDragDataReceived(dropInfo, xDestination, yDestination, forceMove) {
        this.onDragLeave();
        switch (dropInfo.mimetype) {
            case Enums.DndTargetInfo.DING_ICON_LIST:
                if (dropInfo.filelist.length == 0)
                    return;
                let [xOrigin, yOrigin, a, b, c] = this.dragItem.getCoordinates();
                this.doMoveWithDragAndDrop(xOrigin, yOrigin, xDestination, yDestination);
                break;
            case Enums.DndTargetInfo.GNOME_ICON_LIST:
            case Enums.DndTargetInfo.URI_LIST:
                if (dropInfo.filelist.length == 0)
                    return;
                this.clearFileCoordinates(dropInfo.filelist, [xDestination, yDestination]);
                let data = Gio.File.new_for_uri(dropInfo.filelist[0]).query_info('id::filesystem', Gio.FileQueryInfoFlags.NONE, null);
                let idFS = data.get_attribute_string('id::filesystem');
                if ((this.desktopFsId == idFS) || forceMove) {
                    DBusUtils.RemoteFileOperations.MoveURIsRemote(dropInfo.filelist, DesktopIconsUtil.getDesktopDir().get_uri());
                } else {
                    DBusUtils.RemoteFileOperations.CopyURIsRemote(dropInfo.filelist, DesktopIconsUtil.getDesktopDir().get_uri());
                }
                break;
            case Enums.DndTargetInfo.TEXT_PLAIN:
            case Enums.DndTargetInfo.TEXT_PLAIN_UTF8:
                const dropCoordinates = [xDestination, yDestination];
                this.detectURLorText(dropInfo.data, dropCoordinates);
                break;
        }
    }

    detectURLorText(fileList, dropCoordinates) {
        /**
         *
         * @param str
         */
        function isValidURL(str) {
            const [ok, scheme] = GLib.Uri.split(str, 0);
            if (["http", "https", "ftp", "rtsp", "mms"].includes(scheme.toLowerCase()))
                return ok;
            else
                return false;
        }
        let text = fileList.toString();
        if (isValidURL(text)) {
            this.writeURLlinktoDesktop(text, dropCoordinates);
        } else {
            let filename = 'Dragged Text';
            let now = Date().valueOf().split(' ').join('').replace(/:/g, '-');
            filename = `${filename}-${now}`;
            DesktopIconsUtil.writeTextFileToDesktop(text, filename, dropCoordinates);
        }
    }

    writeURLlinktoDesktop(link, dropCoordinates) {
        let filename = link.split('?')[0];
        filename = filename.split('//')[1];
        filename = filename.split('/')[0];
        let now = Date().valueOf().split(' ').join('').replace(/:/g, '-');
        filename = `${filename}-${now}`;
        this.writeHTMLTypeLink(filename, link, dropCoordinates);
    }


    writeHTMLTypeLink(filename, link, dropCoordinates) {
        filename += '.html';
        let body = ['<html>', '<head>', `<meta http-equiv="refresh" content="0; url=${link}" />`, '</head>', '<body>', '</body>', '</html>'];
        body = body.join('\n');
        DesktopIconsUtil.writeTextFileToDesktop(body, filename, dropCoordinates);
    }

    clickCaptured() {
        this._clickCaptured = true;
    }

    onPressMainButton(controller, x, y, grid) {
        if (this._clickCaptured) {
            return;
        }
        this._pressedMouseButton(x, y);
        let state = DesktopIconsUtil.getControllerStatus(controller);
        if (!state.shift && !state.control) {
            // clear selection
            this.unselectAll();
        }
        this._startRubberband(x, y);
    }

    onReleaseMainButton() {
        this._clickCaptured = false;
        if (this.rubberBand) {
            this.rubberBand = false;
            this.selectionRectangle = null;
        }
        for (let grid of this._desktops) {
            grid.queue_draw();
        }
        return false;
    }

    _pressedMouseButton(x, y) {
        this._desktopMenu.setClickCoordinates(x, y);
        this._clickX = Math.floor(x);
        this._clickY = Math.floor(y);
    }

    onPressRightButton(controller, x, y, grid) {
        this._pressedMouseButton(x, y);
        this._desktopMenu.showDesktopMenu(x, y, grid);
    }

    showPopup() {
        this._popupCounter++;
    }

    hidePopup() {
        if (this._popupCounter > 0)
            this._popupCounter--;
        else
            console.log("Mismatched hidePopup() and showPopup() calls");
    }

    _getTopLeftIcon() {
        if (this._fileList.length == 0) {
            return null;
        }
        let currentCoords = null;
        let currentItem = null;
        for (let item of this._fileList) {
            const newCoords = item.getCoordinates();
            if ((currentCoords === null) || (newCoords[0] < currentCoords[0]) || (newCoords[1] < currentCoords[1])) {
                currentCoords = newCoords;
                currentItem = item;
            }
        }
        return currentItem;
    }

    _getBottomRightIcon() {
        if (this._fileList.length == 0) {
            return null;
        }
        let currentCoords = null;
        let currentItem = null;
        for (let item of this._fileList) {
            const newCoords = item.getCoordinates();
            if ((currentCoords === null) || (newCoords[0] > currentCoords[0]) || (newCoords[1] > currentCoords[1])) {
                currentCoords = newCoords;
                currentItem = item;
            }
        }
        return currentItem;
    }

    _setIconAsSelected(icon) {
        this._fileList.forEach(fileItem => fileItem.isKeyboardSelected = fileItem === icon);
    }

    _getLastKeyboardIcon() {
        if ((this._lastSelected !== null) && this._fileList.includes(this._lastSelected)) {
            this._setIconAsSelected(this._lastSelected);
            return this._lastSelected;
        }
        return null;
    }

    _getCurrentKeyboardIcon() {
        let currentKeyboardIcon = null;

        for (let fileItem of this._fileList) {
            if ((currentKeyboardIcon === null) && (fileItem.isKeyboardSelected)) {
                currentKeyboardIcon = fileItem;
            } else {
                if (fileItem.isKeyboardSelected) {
                    fileItem.isKeyboardSelected = false;
                }
            }
        }
        return currentKeyboardIcon;
    }

    onKeyRelease(keyval, keycode, state) {
        if (this._popupCounter != 0)
            return false;

        const isCtrl = (state & Gdk.ModifierType.CONTROL_MASK) != 0;
        const isShift = (state & Gdk.ModifierType.SHIFT_MASK) != 0;

        if ((keyval == Gdk.KEY_Left) || (keyval == Gdk.KEY_Right) ||
        (keyval == Gdk.KEY_Up) || (keyval == Gdk.KEY_Down)) {
            let selected = this._getCurrentKeyboardIcon();
            if (!selected) {
                selected = this._getLastKeyboardIcon();
                if (selected) {
                    return false;
                }
            }
            // if there is no last selected, or the last selected isn't in the desktop
            // (for example, because it was deleted), select the top-left icon.
            if (!selected) {
                selected = this._getTopLeftIcon();
                if (selected) {
                    selected.isKeyboardSelected = true;
                }
                this._lastSelected = selected;
                return false;
            }
            let selectedCoordinates = selected.getCoordinates();
            let index;
            let multiplier;
            switch (keyval) {
                case Gdk.KEY_Left:
                    index = 0;
                    multiplier = -1;
                    break;
                case Gdk.KEY_Right:
                    index = 0;
                    multiplier = 1;
                    break;
                case Gdk.KEY_Up:
                    index = 1;
                    multiplier = -1;
                    break;
                case Gdk.KEY_Down:
                    index = 1;
                    multiplier = 1;
                    break;
            }
            let newDistance = null;
            let newItem = null;
            for (let item of this._fileList) {
                let itemCoordinates = item.getCoordinates();
                if ((selectedCoordinates[index] * multiplier) >= (itemCoordinates[index] * multiplier)) {
                    continue;
                }
                let distance = Math.pow(selectedCoordinates[0] - itemCoordinates[0], 2) + Math.pow(selectedCoordinates[1] - itemCoordinates[1], 2);
                if ((newDistance === null) || (newDistance > distance)) {
                    newDistance = distance;
                    newItem = item;
                }
            }
            if (newItem === null) {
                newItem = selected;
            } else {
                selected.isKeyboardSelected = false;
                if (isCtrl || isShift) {
                    selected.setSelected();
                }
            }
            newItem.isKeyboardSelected = true;
            this._lastSelected = newItem;
            return false;
        }
        return false;
    }

    onKeyPress(keyval, keycode, state, grid, timestamp) {
        if (this._popupCounter != 0)
            return false;
        const isCtrl = (state & Gdk.ModifierType.CONTROL_MASK) != 0;
        const isShift = (state & Gdk.ModifierType.SHIFT_MASK) != 0;
        const isAlt = (state & Gdk.ModifierType.MOD1_MASK) != 0;
        let selection = this.getCurrentSelection(false);
        if (keyval == Gdk.KEY_Home) {
            this._setIconAsSelected(this._getTopLeftIcon());
            return true;
        } else if (keyval == Gdk.KEY_End) {
            this._setIconAsSelected(this._getBottomRightIcon());
            return true;
        } else if (isCtrl && (keyval === Gdk.KEY_space)) {
            const selected = this._getCurrentKeyboardIcon();
            if (selected !== null) {
                selected.toggleSelected();
                return true;
            }
        } else if (isCtrl && isShift && ((keyval == Gdk.KEY_Z) || (keyval == Gdk.KEY_z))) {
            this._doRedo();
            return true;
        } else if (isCtrl && ((keyval == Gdk.KEY_Z) || (keyval == Gdk.KEY_z))) {
            this.doUndo();
            return true;
        } else if (isCtrl && ((keyval == Gdk.KEY_C) || (keyval == Gdk.KEY_c))) {
            this.doCopy();
            return true;
        } else if (isCtrl && ((keyval == Gdk.KEY_X) || (keyval == Gdk.KEY_x))) {
            this.doCut();
            return true;
        } else if (isCtrl && ((keyval == Gdk.KEY_V) || (keyval == Gdk.KEY_v))) {
            this.doPaste(true).catch(e => {console.log(`Error doing paste from keyboard: ${e.message}\n${e.stack}`)});;
            return true;
        } else if (isAlt && (keyval == Gdk.KEY_Return)) {
            let currentSelection = this.getCurrentSelection(true);
            DBusUtils.RemoteFileOperations.ShowItemPropertiesRemote(currentSelection, Gdk.CURRENT_TIME);
            return true;
        } else if (keyval == Gdk.KEY_Return) {
            if (selection && (selection.length == 1)) {
                selection[0].doOpen(timestamp);
                return true;
            }
        } else if (keyval == Gdk.KEY_F2) {
            if (selection && (selection.length == 1)) {
                // Support renaming other grids file items.
                this.doRename(selection[0], false);
                return true;
            }
        } else if (selection && keyval == Gdk.KEY_space) {
            // Support previewing other grids file items.
            DBusUtils.RemoteFileOperations.ShowFileRemote(selection[0].uri, 0, true);
            return true;
        } else if (isCtrl && ((keyval == Gdk.KEY_A) || (keyval == Gdk.KEY_a))) {
            this.selectAll();
            return true;
        } else if (keyval == Gdk.KEY_F5) {
            this._updateDesktop().catch(e => {
                print(`Exception while updating Desktop after pressing F5: ${e.message}\n${e.stack}`);
            });
            return true;
        } else if (isCtrl && ((keyval == Gdk.KEY_H) || (keyval == Gdk.KEY_h))) {
            Prefs.gtkSettings.set_boolean('show-hidden', !this._showHidden);
            return true;
        } else if (isCtrl && ((keyval == Gdk.KEY_F) || (keyval == Gdk.KEY_f))) {
            this.findFiles(grid.Window);
            return true;
        } else if (keyval == Gdk.KEY_Escape) {
            this.unselectAll();
            if (this.searchString) {
                this.searchString = null;
            }
            return true;
        } else if ((keyval == Gdk.KEY_Menu) || ((keyval == Gdk.KEY_F10) && isShift)) {
            if (selection) {
                this._fileItemMenu.showMenu(selection[0], null, true);
            } else {
                this._desktopMenu.showDesktopMenu(0, 0, this._desktops[0]._container);
            }
            return true;
        } else if (isCtrl && (keyval == Gdk.KEY_plus)) {
            Prefs.increase_icon_size();
            return true;
        } else if (isCtrl && (keyval == Gdk.KEY_minus)) {
            Prefs.decrease_icon_size();
            return true;
        } else {
            if (this.ignoreKeys.includes(keyval)) {
                return false;
            }
            let key = String.fromCharCode(Gdk.keyval_to_unicode(keyval));
            if (this.keypressTimeoutID && this.searchString) {
                this.searchString = this.searchString.concat(key);
            } else {
                this.searchString = key;
            }
            if (this.searchString != '') {
                let found = this.scanForFiles(this.searchString, false);
                if (found) {
                    if ((this.getNumberOfSelectedItems() >= 1) && !this.keypressTimeoutID) {
                        let windowError = new ShowErrorPopup.ShowErrorPopup(
                            _('Clear Current Selection before New Search'),
                            null,
                            true);
                        windowError.timeoutClose(2000);
                        return true;
                    }
                    this._refreshSearchTimeout();
                    this.findFiles(grid.Window, this.searchString);
                }
            }
            return true;
        }
        return false;
    }

    async updateClipboard() {
        this._clipboardFiles = null;
        const clipboardData = await dndClipboardUtils.readClipboard([Enums.DndTargetInfo.GNOME_CLIPBOARD, Enums.DndTargetInfo.URI_LIST]);
        if (clipboardData === null) {
            return false;
        }
        const data = dndClipboardUtils.processFileList(clipboardData.mimetype, clipboardData.data);
        if (!['cut', 'copy'].includes(data.action)) {
            return false;
        }
        this._isCut = (data.action === 'cut');
        this._clipboardFiles = data.files;
        return true;
    }

    async doPaste(refresh) {
        if (refresh) {
            await this.updateClipboard();
        }
        if (this._clipboardFiles === null) {
            return;
        }
        let desktopDir = this._desktopDir.get_uri();
        if (this._isCut) {
            DBusUtils.RemoteFileOperations.MoveURIsRemote(this._clipboardFiles, desktopDir);
        } else {
            DBusUtils.RemoteFileOperations.CopyURIsRemote(this._clipboardFiles, desktopDir);
        }
    }

    unselectAll() {
        this._fileList.map(f => {
            f.unsetSelected();
            f.isKeyboardSelected = false;
        });
    }

    _refreshSearchTimeout() {
        if (this.keypressTimeoutID) {
            GLib.source_remove(this.keypressTimeoutID);
            this.keypressTimeoutID = null;
        }
        if (Prefs.a11YKeyboard) {
            // if the user has enabled any keyboard assistive technology,
            // disable the timeout to hide the search window
            if (Prefs.a11YKeyboard.get_boolean('stickykeys-enable') ||
                Prefs.a11YKeyboard.get_boolean('slowkeys-enable') ||
                Prefs.a11YKeyboard.get_boolean('bouncekeys-enable') ||
                Prefs.a11YKeyboard.get_boolean('mousekeys-enable')) {
                    return;
            }
        }
        if (Prefs.a11YApplications) {
            // if the user has enabled the screen reader,
            // disable the timeout to hide the search window
            if (Prefs.a11YApplications.get_boolean('screen-reader-enabled')) {
                return;
            }
        }

        this.keypressTimeoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
            this.searchString = null;
            this.keypressTimeoutID = null;
            if (this._findFileWindow) {
                this._closeFindFiles(false);
            }
            return false;
        });
    }

    showFileMenu(fileItem, x, y) {
        this._fileItemMenu.showMenu(fileItem, x, y);
    }

    findFiles(window, text) {
        this._findFileWindow = new Adw.Dialog({
            'title': _('Find Files on Desktop'),
        });
        const container = new Gtk.Box({
            'orientation': Gtk.Orientation.VERTICAL,
        });
        this._findFileWindow.set_child(container);
        const topBar = new Adw.HeaderBar({
            'show-title': true,
            'decoration-layout': '',
        });
        this._findFileButton = Gtk.Button.new_with_label(_('OK'));
        this._findFileButton.sensitive = false;
        topBar.pack_end(this._findFileButton);
        const cancelButton = Gtk.Button.new_with_label(_('Cancel'));
        topBar.pack_start(cancelButton);
        container.append(topBar);

        this._findFileTextArea = new Gtk.Entry({
            margin_start: 18,
            margin_end: 18,
            margin_top: 18,
            margin_bottom: 18,
        });
        container.append(this._findFileTextArea);

        this._findFileSignalManager = new SignalManager.SignalManager();
        this._findFileSignalManager.connectSignal(this._findFileTextArea, 'activate', () => {
            if (this._findFileButton.sensitive) {
                this._closeFindFiles(false);
            }
        });
        this._findFileSignalManager.connectSignal(this._findFileButton, 'clicked', () => {
            this._closeFindFiles(false);
        });
        this._findFileSignalManager.connectSignal(cancelButton, 'clicked', () => {
            this._closeFindFiles(true);
        });
        let keyController = new Gtk.EventControllerKey();
        this._findFileWindow.add_controller(keyController);
        this._findFileSignalManager.connectSignal(keyController, 'key-pressed', (controller, keyval, keycode, state) => {
            if (keyval == Gdk.KEY_Escape) {
                this._closeFindFiles(true);
                return true;
            }
            return false;
        });
        this._findFileSignalManager.connectSignal(this._findFileTextArea, 'changed', () => {
            if (this.scanForFiles(this._findFileTextArea.text, true)) {
                this._findFileButton.sensitive = true;
                if (this._findFileTextArea.has_css_class('not-found')) {
                    this._findFileTextArea.remove_css_class('not-found');
                }
            } else {
                this._findFileButton.sensitive = false;
                this._findFileTextArea.error_bell();
                if (!this._findFileTextArea.has_css_class('not-found')) {
                    this._findFileTextArea.add_css_class('not-found');
                }
            }
            this._refreshSearchTimeout();
        });
        this._findFileWindow.show();
        this._findFileWindow.present(window);
        this._findFileTextArea.grab_focus();
        if (text) {
            this._findFileTextArea.set_text(text);
            this._findFileTextArea.set_position(text.length);
        } else {
            this.scanForFiles(null);
        }
    }

    _closeFindFiles(cancelled) {
        if (cancelled) {
            this.unselectAll();
        }
        this._findFileSignalManager.disconnectAllSignals();
        this._findFileWindow.close();
        this._findFileWindow = null;
    }

    scanForFiles(text, setselected) {
        let found = [];
        if (text && (text != '')) {
            found = this._fileList.filter(f => f.fileName.toLowerCase().includes(text.toLowerCase()) || f._label.get_text().toLowerCase().includes(text.toLowerCase()));
        }
        if (found.length != 0) {
            if (setselected) {
                this.unselectAll();
                found.map(f => f.setSelected());
            }
            return true;
        } else {
            return false;
        }
    }

    selectAll() {
        for (let fileItem of this._fileList) {
            if (fileItem.isAllSelectable) {
                fileItem.setSelected();
            }
        }
    }

    _parseClipboardText(text) {
        if (text === null) {
            return [false, false, null];
        }

        let lines = text.split('\n');
        let [mime, action, ...files] = lines;

        if (mime != 'x-special/nautilus-clipboard') {
            return [false, false, null];
        }
        if (!['copy', 'cut'].includes(action)) {
            return [false, false, null];
        }
        let isCut = action == 'cut';

        /* Last line is empty due to the split */
        if (files.length <= 1) {
            return [false, false, null];
        }
        /* Remove last line */
        files.pop();

        return [true, isCut, files];
    }

    onMotion(x, y) {
        if (this.rubberBand) {
            this.x1 = Math.floor(Math.min(x, this.rubberBandInitX));
            this.x2 = Math.floor(Math.max(x, this.rubberBandInitX));
            this.y1 = Math.floor(Math.min(y, this.rubberBandInitY));
            this.y2 = Math.floor(Math.max(y, this.rubberBandInitY));
            this.selectionRectangle = new Gdk.Rectangle({ 'x': this.x1, 'y': this.y1, 'width': this.x2 - this.x1, 'height': this.y2 - this.y1 });
            for (let grid of this._desktops) {
                grid.queue_draw();
            }
            for (let item of this._fileList) {
                if (item.checkIntersects(this.selectionRectangle)) {
                    item.setSelected();
                    item.touchedByRubberband = true;
                } else if (item.touchedByRubberband) {
                    item.unsetSelected();
                }
            }
        }
        return false;
    }

    onCancelledMainButton() {
        this.onReleaseMainButton();
    }

    _startRubberband(x, y) {
        this.rubberBandInitX = x;
        this.rubberBandInitY = y;
        this.rubberBand = true;
        for (let item of this._fileList) {
            item.touchedByRubberband = false;
        }
    }

    selected(fileItem, action) {
        switch (action) {
            case Enums.Selection.ALONE:
                if (!fileItem.isSelected) {
                    for (let item of this._fileList) {
                        if (item === fileItem) {
                            item.setSelected();
                        } else {
                            item.unsetSelected();
                        }
                    }
                }
                break;
            case Enums.Selection.WITH_SHIFT:
                fileItem.toggleSelected();
                break;
            case Enums.Selection.RIGHT_BUTTON:
                if (!fileItem.isSelected) {
                    for (let item of this._fileList) {
                        if (item === fileItem) {
                            item.setSelected();
                        } else {
                            item.unsetSelected();
                        }
                    }
                }
                break;
            case Enums.Selection.ENTER:
                if (this.rubberBand) {
                    fileItem.setSelected();
                }
                break;
            case Enums.Selection.RELEASE:
                for (let item of this._fileList) {
                    if (item === fileItem) {
                        item.setSelected();
                    } else {
                        item.unsetSelected();
                    }
                }
                break;
        }
    }

    _removeAllFilesFromGrids() {
        for (let fileItem of this._fileList) {
            fileItem.removeFromGrid(true);
        }
        this._fileList = [];
    }

    async _updateDesktop() {
        if (this._readingDesktopFiles) {
            // just notify that the files changed while being read from the disk.
            this._desktopFilesChanged = true;
            if (this._desktopEnumerateCancellable && !this._forceDraw) {
                this._desktopEnumerateCancellable.cancel();
                this._desktopEnumerateCancellable = null;
            }
            return;
        }

        this._readingDesktopFiles = true;
        this._forceDraw = false;
        this._lastDesktopUpdateRequest = GLib.get_monotonic_time();
        let fileList = [];
        /* eslint-disable no-await-in-loop */
        while (true) {
            this._desktopFilesChanged = false;
            if (!this._desktopDir.query_exists(null)) {
                fileList = [];
                break;
            }
            fileList = await this._doReadAsync();
            if (this._forcedExit) {
                return;
            }
            if (fileList !== null) {
                if (!this._desktopFilesChanged) {
                    break;
                }
                if (this._forceDraw) {
                    this._drawDesktop(fileList);
                    this._lastDesktopUpdateRequest = GLib.get_monotonic_time();
                } else {
                    // Destroy the unused FileItems to prevent memory leak
                    for (let item of fileList) {
                        item._onDestroy();
                    }
                }
            }
            await DesktopIconsUtil.waitDelayMs(500);
            if ((GLib.get_monotonic_time() - this._lastDesktopUpdateRequest) > 1000000) {
                this._forceDraw = true;
            } else {
                this._forceDraw = false;
            }
        }
        this._readingDesktopFiles = false;
        this._forceDraw = false;
        this._drawDesktop(fileList);
    }

    _doReadAsync() {
        if (this._desktopEnumerateCancellable) {
            this._desktopEnumerateCancellable.cancel();
        }
        this._desktopEnumerateCancellable = new Gio.Cancellable();
        return new Promise((resolve, reject) => {
            this._desktopDir.enumerate_children_async(
                Enums.DEFAULT_ATTRIBUTES,
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_DEFAULT,
                this._desktopEnumerateCancellable,
                (source, result) => {
                    this._desktopEnumerateCancellable = null;
                    try {
                        let fileEnum = source.enumerate_children_finish(result);
                        if (this._desktopFilesChanged && !this._forceDraw) {
                            resolve(null);
                            return;
                        }
                        let fileList = [];
                        for (let [newFolder, extras] of DesktopIconsUtil.getExtraFolders()) {
                            try {
                                fileList.push(new FileItem.FileItem(this,
                                    newFolder,
                                    newFolder.query_info(Enums.DEFAULT_ATTRIBUTES, Gio.FileQueryInfoFlags.NONE, null),
                                    extras,
                                    null));
                            } catch (e) {
                                print(`Failed with ${e.message} while adding extra folder ${newFolder.get_uri()}\n${e.stack}`);
                            }
                        }
                        let info;
                        while ((info = fileEnum.next_file(null))) {
                            let fileItem = new FileItem.FileItem(this,
                                fileEnum.get_child(info),
                                info,
                                Enums.FileType.NONE,
                                null);
                            if (fileItem.isHidden && !this._showHidden) {
                                /* if there are hidden files in the desktop and the user doesn't want to
                                    show them, remove the coordinates. This ensures that if the user enables
                                    showing them, they won't fight with other icons for the same place
                                */
                                if (fileItem.savedCoordinates) {
                                    // only overwrite them if needed
                                    fileItem.savedCoordinates = null;
                                }
                                fileItem._onDestroy();
                                continue;
                            }
                            fileList.push(fileItem);
                            if (fileItem.dropCoordinates == null) {
                                let basename = fileItem.file.get_basename();
                                if (basename in this._pendingDropFiles) {
                                    fileItem.dropCoordinates = this._pendingDropFiles[basename];
                                    delete this._pendingDropFiles[basename];
                                }
                            }
                        }
                        for (let [newFolder, extras, volume] of DesktopIconsUtil.getMounts(this._volumeMonitor)) {
                            try {
                                fileList.push(new FileItem.FileItem(this,
                                    newFolder,
                                    newFolder.query_info(Enums.DEFAULT_ATTRIBUTES, Gio.FileQueryInfoFlags.NONE, null),
                                    extras,
                                    volume));
                            } catch (e) {
                                print(`Failed with ${e} while adding volume ${newFolder}`);
                            }
                        }
                        resolve(fileList);
                        return;
                    } catch (e) {
                        resolve(null);
                    }
                }
            );
        });
    }

    _drawDesktop(fileList) {
        // Clear stacking data that references items about to be destroyed
        this._allFileList = null;
        this.stackInitialCoordinates = null;
        this._selectedFiles = this.getCurrentSelection(true);
        if (this._renameWindow) {
            // disconnect the popup from the fileItem to avoid it being
            // destroyed when the fileItem is removed from the desktop
            this._renameWindow.updateFileItem(null);
        }
        this._removeAllFilesFromGrids();
        this._fileList = fileList;
        // Select the files that were selected before the repaint
        if (this._selectedFiles) {
            for (let fileItem of fileList) {
                if (this._selectedFiles.includes(fileItem.uri)) {
                    fileItem.setSelected();
                }
            }
        }
        if (this._renameWindow) {
            // assign the popover to the new fileItem
            let file = fileList.filter(f => f.fileName == this._renamingFile)[0];
            if (file) {
                file.setRenamePopup(this._renameWindow);
            } else {
                this._renameWindow.closeWindow();
            }
        }
        this._placeAllFilesOnGrids();
        this._fileItemMenu.refreshedIcons();
        this._selectedFiles = null;
    }

    _placeAllFilesOnGrids(redisplay = false) {
        this.keepStacked = Prefs.desktopSettings.get_boolean('keep-stacked');
        this.keepArranged = Prefs.desktopSettings.get_boolean('keep-arranged');
        this.sortSpecialFolders = Prefs.desktopSettings.get_boolean('sort-special-folders');
        if (this.keepStacked) {
            this.doStacks(redisplay);
        } else if (this.keepArranged) {
            this.doSorts();
        } else {
            this._addFilesToDesktop(this._fileList, Enums.StoredCoordinates.PRESERVE);
        }
    }

    _addFilesToDesktop(fileList, storeMode) {
        if (this._desktops.length == 0) {
            return;
        }
        let outOfDesktops = [];
        let notAssignedYet = [];

        // First, add those icons that fit in the current desktops
        for (let fileItem of fileList) {
            if (fileItem.savedCoordinates == null) {
                notAssignedYet.push(fileItem);
                continue;
            }
            if (fileItem.dropCoordinates != null) {
                fileItem.dropCoordinates = null;
            }
            let [itemX, itemY] = fileItem.savedCoordinates;
            let addedToDesktop = false;
            for (let desktop of this._desktops) {
                if (desktop.getDistance(itemX, itemY) == 0) {
                    addedToDesktop = true;
                    desktop.addFileItemCloseTo(fileItem, itemX, itemY, storeMode);
                    break;
                }
            }
            if (!addedToDesktop) {
                outOfDesktops.push(fileItem);
            }
        }
        // Now, assign those icons that are outside the current desktops,
        // but have assigned coordinates
        for (let fileItem of outOfDesktops) {
            let minDistance = -1;
            let [itemX, itemY] = fileItem.savedCoordinates;
            let newDesktop = null;
            for (let desktop of this._desktops) {
                let distance = desktop.getDistance(itemX, itemY);
                if (distance == -1) {
                    continue;
                }
                if ((minDistance == -1) || (distance < minDistance)) {
                    minDistance = distance;
                    newDesktop = desktop;
                }
            }
            if (newDesktop == null) {
                print('Not enough space to add icons');
                break;
            } else {
                newDesktop.addFileItemCloseTo(fileItem, itemX, itemY, storeMode);
            }
        }
        // Finally, assign those icons that still don't have coordinates
        for (let fileItem of notAssignedYet) {
            let x, y;
            if (fileItem.dropCoordinates == null) {
                if (this._primaryScreen !== null) {
                    x = this._primaryScreen.x;
                    y = this._primaryScreen.y;
                } else {
                    x = 0;
                    y = 0;
                }
                storeMode = Enums.StoredCoordinates.ASSIGN;
            } else {
                [x, y] = fileItem.dropCoordinates;
                fileItem.dropCoordinates = null;
                storeMode = Enums.StoredCoordinates.OVERWRITE;
            }
            // try first in the designated desktop
            let assigned = false;
            for (let desktop of this._desktops) {
                if (desktop.getDistance(x, y) == 0) {
                    desktop.addFileItemCloseTo(fileItem, x, y, storeMode);
                    assigned = true;
                    break;
                }
            }
            if (assigned) {
                continue;
            }
            // if there is no space in the designated desktop, try in another
            for (let desktop of this._desktops) {
                if (desktop.getDistance(x, y) != -1) {
                    desktop.addFileItemCloseTo(fileItem, x, y, storeMode);
                    break;
                }
            }
        }
    }

    _updateWritableByOthers() {
        let info = this._desktopDir.query_info(Gio.FILE_ATTRIBUTE_UNIX_MODE,
            Gio.FileQueryInfoFlags.NONE,
            null);
        this.unixMode = info.get_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE);
        let writableByOthers = (this.unixMode & Enums.S_IWOTH) != 0;
        if (writableByOthers != this.writableByOthers) {
            this.writableByOthers = writableByOthers;
            if (this.writableByOthers) {
                print('desktop-icons: Desktop is writable by others - will not allow launching any desktop files');
            }
            return true;
        } else {
            return false;
        }
    }

    _updateDesktopIfChanged(file, otherFile, eventType) {
        if (eventType == Gio.FileMonitorEvent.CHANGED) {
            // use only CHANGES_DONE_HINT
            return;
        }
        if (!this._showHidden && (file.get_basename()[0] == '.')) {
            // If the file is not visible, we don't need to refresh the desktop
            // Unless it is a hidden file being renamed to visible
            if (!otherFile || (otherFile.get_basename()[0] == '.')) {
                return;
            }
        }
        switch (eventType) {
            case Gio.FileMonitorEvent.MOVED_IN:
            case Gio.FileMonitorEvent.MOVED_CREATED:
                /* Remove the coordinates that could exist to avoid conflicts between
                       files that are already in the desktop and the new one
                     */
                try {
                    let info = new Gio.FileInfo();
                    info.set_attribute_string('metadata::nautilus-icon-position', '');
                    file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
                } catch (e) { } // can happen if a file is created and deleted very fast
                break;
            case Gio.FileMonitorEvent.ATTRIBUTE_CHANGED:
                /* The desktop is what changed, and not a file inside it */
                if (file.get_uri() == this._desktopDir.get_uri()) {
                    if (this._updateWritableByOthers()) {
                        this._updateDesktop().catch(e => {
                            print(`Exception while updating Desktop from Directory Monitor Attribute Change: ${e.message}\n${e.stack}`);
                        });
                    }
                    return;
                }
                break;
        }
        this._updateDesktop().catch(e => {
            print(`Exception while updating Desktop from Directory Monitor: ${e.message}\n${e.stack}`);
        });
    }

    _getClipboardText() {
        let selection = this.getCurrentSelection(true);
        if (selection) {
            return new GLib.Variant('as', selection);
        } else {
            return new GLib.Variant('as', []);
        }
    }

    doCopy() {
        dndClipboardUtils.manageCutCopy({ copy: true, fileList: this.getCurrentSelection(false) });
    }

    doCut() {
        dndClipboardUtils.manageCutCopy({ copy: false, fileList: this.getCurrentSelection(false) });
    }

    doTrash() {
        const selection = this._fileList.filter(i => (i.isSelected || i.isKeyboardSelected) && !i.isSpecial).map(i =>
            i.file.get_uri());

        if (selection.length) {
            DBusUtils.RemoteFileOperations.TrashURIsRemote(selection);
        }
    }

    doDeletePermanently() {
        const toDelete = this._fileList.filter(i => (i.isSelected || i.isKeyboardSelected) && !i.isSpecial).map(i =>
            i.file.get_uri());

        if (!toDelete.length) {
            if (this._fileList.some(i => (i.isSelected || i.isKeyboardSelected) && i.isTrash)) {
                this.doEmptyTrash();
            }
            return;
        }

        DBusUtils.RemoteFileOperations.DeleteURIsRemote(toDelete);
    }

    doEmptyTrash(askConfirmation = true) {
        DBusUtils.RemoteFileOperations.EmptyTrashRemote(askConfirmation);
    }

    checkIfSpecialFilesAreSelected() {
        for (let item of this._fileList) {
            if (item.isSelected && item.isSpecial) {
                return true;
            }
        }
        return false;
    }

    checkIfDirectoryIsSelected() {
        for (let item of this._fileList) {
            if ((item.isSelected || item.isKeyboardSelected) && item.isDirectory) {
                return true;
            }
        }
        return false;
    }

    getCurrentSelection(getUri = false) {
        let listToTrash = [];
        for (let fileItem of this._fileList) {
            if ((fileItem.isSelected) || (fileItem.isKeyboardSelected)) {
                if (getUri) {
                    listToTrash.push(fileItem.file.get_uri());
                } else {
                    listToTrash.push(fileItem);
                }
            }
        }
        if (listToTrash.length !== 0) {
            return listToTrash;
        } else {
            return null;
        }
    }

    getNumberOfSelectedItems() {
        let count = 0;
        for (let item of this._fileList) {
            if ((item.isSelected) || (item.isKeyboardSelected)) {
                count++;
            }
        }
        return count;
    }

    getFileItemFromURI(uri) {
        for (let item of this._fileList) {
            if (uri == item.uri) {
                return item;
            }
        }
        return null;
    }

    doRename(fileItem, allowReturnOnSameName) {
        if (!fileItem || !fileItem.canRename) {
            return;
        }
        this.unselectAll();
        if (!this._renameWindow) {
            this._renamingFile = fileItem.fileName;
            this._renameWindow = new AskRenamePopup.AskRenamePopup(this, fileItem, allowReturnOnSameName, () => {
                this._renameWindow = null;
                this.newFolderDoRename = null;
                this._renamingFile = null;
            });
        }
    }

    fileExistsOnDesktop(searchName) {
        const listOfFileNamesOnDesktop = this.updateFileList().map(f => f.fileName);
        if (listOfFileNamesOnDesktop.includes(searchName)) {
            return true;
        } else {
            return false;
        }
    }

    getDesktopUniqueFileName(fileName) {
        let fileParts = DesktopIconsUtil.getFileExtensionOffset(fileName);
        let i = 0;
        let newName = fileName;

        while (this.fileExistsOnDesktop(newName)) {
            i += 1;
            newName = `${fileParts.basename} ${i}${fileParts.extension}`;
        }
        return newName;
    }

    doNewFolder(position = null, suggestedName = null, opts = { rename: true }) {
        this.unselectAll();

        if (!position) {
            position = [this._clickX, this._clickY];
        }

        const baseName = suggestedName ? suggestedName : _('New Folder');
        let newName = this.getDesktopUniqueFileName(baseName);

        if (newName) {
            let dir = DesktopIconsUtil.getDesktopDir().get_child(newName);
            try {
                dir.make_directory(null);
                const info = new Gio.FileInfo();
                info.set_attribute_string('metadata::nautilus-drop-position', `${position.join(',')}`);
                info.set_attribute_string('metadata::nautilus-icon-position', '');
                dir.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
            } catch (e) {
                console.error(e, 'Failed to create folder');
                const header = _('Folder Creation Failed');
                const text = _('Error while trying to create a Folder');
                this.dbusManager.doNotify(header, text);
                if (position || suggestedName) {
                    return null;
                }
                return null;
            }
            if (opts.rename) {
                this.newFolderDoRename = newName;
            }
            if (position || suggestedName) {
                return dir.get_uri();
            }
        }
        return null;
    }


    doStacks(restack) {
        const selected = this._getCurrentKeyboardIcon()?.uri;
        if (restack) {
            for (let fileItem of this._fileList) {
                fileItem.removeFromGrid(false);
            }
        }
        if (!this.stackInitialCoordinates && !this._allFileList) {
            this._allFileList = [];
            this._saveStackInitialCoordinates();
            restack = false;
        }
        this._sortAllFilesFromGridsByKindStacked(restack);
        this._reassignFilesToDesktop();
        if (selected) {
            this._fileList.forEach(icon => icon.isKeyboardSelected = (icon.uri === selected));
        }
    }

    _unstack() {
        if (this.stackInitialCoordinates && this._allFileList) {
            this._fileList.forEach(f => f.removeFromGrid(false));
            this._restoreStackInitialCoordinates();
            this._fileList = this._allFileList;
            this._allFileList = null;
            if (this.keepArranged) {
                this.doSorts();
            } else {
                this._addFilesToDesktop(this._fileList, Enums.StoredCoordinates.PRESERVE);
            }
        }
    }

    _saveStackInitialCoordinates() {
        this.stackInitialCoordinates = [];
        for (let fileItem of this._fileList) {
            this.stackInitialCoordinates.push([fileItem.fileName, fileItem.savedCoordinates]);
        }
    }

    _restoreStackInitialCoordinates() {
        if (this.stackInitialCoordinates && this.stackInitialCoordinates.length != 0) {
            this._allFileList.forEach(fileItem => {
                this.stackInitialCoordinates.forEach(savedItem => {
                    if (savedItem[0] == fileItem.fileName) {
                        fileItem.savedCoordinates = savedItem[1];
                    }
                });
            });
        }
        this.stackInitialCoordinates = null;
    }

    _makeStackTopMarkerFolder(type, list) {
        let stackAttribute = type.split('/')[1];
        let fileItem = new stackItem.stackItem(
            this,
            stackAttribute,
            type,
            Enums.FileType.STACK_TOP
        );
        list.push(fileItem);
    }

    _sortAllFilesFromGridsByKindStacked(restack) {
        /**
         *
         */
        function determineStackTopSizeOrTime() {
            for (let item of otherFiles) {
                if (item.isStackMarker) {
                    for (let unstackitem of stackedFiles) {
                        if (item.attributeContentType == unstackitem.attributeContentType) {
                            item.size = unstackitem.fileSize;
                            item.time = unstackitem.modifiedTime;
                            break;
                        }
                    }
                }
            }
        }

        let specialFiles = [];
        let directoryFiles = [];
        let validDesktopFiles = [];
        let otherFiles = [];
        let stackedFiles = [];
        let newFileList = [];
        let stackTopMarkerFolderList = [];
        let unstackList = Prefs.getUnstackList();
        if (this._allFileList && restack) {
            this._fileList = this._allFileList;
        }
        this._sortByName(this._fileList);
        for (let fileItem of this._fileList) {
            if (fileItem.isSpecial) {
                specialFiles.push(fileItem);
                continue;
            }
            if (fileItem.isDirectory) {
                directoryFiles.push(fileItem);
                continue;
            }
            if (fileItem._isValidDesktopFile) {
                validDesktopFiles.push(fileItem);
                continue;
            } else {
                let type = fileItem.attributeContentType;
                let stacked = false;
                for (let item of otherFiles) {
                    if (type == item.attributeContentType) {
                        stackedFiles.push(fileItem);
                        stacked = true;
                    }
                }
                if (!stacked) {
                    fileItem.isStackTop = true;
                    otherFiles.push(fileItem);
                }
                continue;
            }
        }
        for (let a of otherFiles) {
            let instack = false;
            for (let c of stackedFiles) {
                if (c.attributeContentType == a.attributeContentType) {
                    instack = true;
                    break;
                }
            }
            if (!instack) {
                a.stackUnique = true;
            }
            continue;
        }
        for (let item of otherFiles) {
            if (!item.stackUnique) {
                this._makeStackTopMarkerFolder(item.attributeContentType, stackTopMarkerFolderList);
                item.isStackTop = false;
                stackedFiles.push(item);
            }
            if (item.stackUnique) {
                stackTopMarkerFolderList.push(item);
            }
            item.updateIcon();
        }
        otherFiles = [];
        this._sortByName(specialFiles);
        this._sortByName(directoryFiles);
        this._sortByName(validDesktopFiles);
        this._sortByKindByName(stackedFiles);
        this._sortByKindByName(stackTopMarkerFolderList);
        otherFiles.push(...specialFiles);
        otherFiles.push(...validDesktopFiles);
        otherFiles.push(...directoryFiles);
        otherFiles.push(...stackTopMarkerFolderList);
        /**
         *
         * @param a
         * @param b
         */
        function bySize(a, b) {
            return a.fileSize - b.fileSize;
        }
        /**
         *
         * @param a
         * @param b
         */
        function byTime(a, b) {
            return a._modifiedTime - b._modifiedTime;
        }
        switch (Prefs.getSortOrder()) {
            case Enums.SortOrder.NAME:
                this._sortByName(otherFiles);
                break;
            case Enums.SortOrder.DESCENDINGNAME:
                this._sortByName(otherFiles);
                otherFiles.reverse();
                this._sortByName(stackedFiles);
                stackedFiles.reverse();
                break;
            case Enums.SortOrder.MODIFIEDTIME:

                stackedFiles.sort(byTime);
                determineStackTopSizeOrTime();
                otherFiles.sort(byTime);
                break;
            case Enums.SortOrder.KIND:
                break;
            case Enums.SortOrder.SIZE:
                stackedFiles.sort(bySize);
                determineStackTopSizeOrTime();
                otherFiles.sort(bySize);
                break;
            default:
                break;
        }
        for (let item of otherFiles) {
            newFileList.push(item);
            let itemtype = item.attributeContentType;
            for (let unstackitem of stackedFiles) {
                if (unstackList.includes(unstackitem.attributeContentType) && (unstackitem.attributeContentType == itemtype)) {
                    newFileList.push(unstackitem);
                }
            }
        }
        if (this._allFileList) {
            this._allFileList = this._fileList;
        }
        this._fileList = newFileList;
    }

    _sortByName(fileList) {
        /**
         *
         * @param a
         * @param b
         */
        function byName(a, b) {
            // sort by label name instead of the the fileName or displayName so that the "Home" folder is sorted in the correct order
            // alphabetical sort taking into account accent characters & locale, natural language sort for numbers, ie 10.etc before 2.etc
            // other options for locale are best fit, or by specifying directly in function below for translators
            return a._label.get_text().localeCompare(b._label.get_text(), { sensitivity: 'accent', numeric: 'true', localeMatcher: 'lookup' });
        }
        fileList.sort(byName);
    }

    _sortByKindByName(fileList) {
        /**
         *
         * @param a
         * @param b
         */
        function byKindByName(a, b) {
            return a.attributeContentType.localeCompare(b.attributeContentType) ||
                a._label.get_text().localeCompare(b._label.get_text(), { sensitivity: 'accent', numeric: 'true', localeMatcher: 'lookup' });
        }
        fileList.sort(byKindByName);
    }

    _sortAllFilesFromGridsByName(order) {
        this._sortByName(this._fileList);
        if (order == Enums.SortOrder.DESCENDINGNAME) {
            this._fileList.reverse();
        }
        this._reassignFilesToDesktop();
    }

    sortAllFilesFromGridsByPosition() {
        if (this.keepArranged) {
            return;
        }
        this._fileList.map(f => f.removeFromGrid(false));
        let cornerInversion = Prefs.get_start_corner();
        if (!cornerInversion[0] && !cornerInversion[1]) {
            this._fileList.sort((a, b) => {
                if (a._x1 < b._x1) {
                    return -1;
                }
                if (a._x1 > b._x1) {
                    return 1;
                }
                if (a._y1 < b._y1) {
                    return -1;
                }
                if (a._y1 > b._y1) {
                    return 1;
                }
                return 0;
            });
        }
        if (cornerInversion[0] && cornerInversion[1]) {
            this._fileList.sort((a, b) => {
                if (a._x1 < b._x1) {
                    return 1;
                }
                if (a._x1 > b._x1) {
                    return -1;
                }
                if (a._y1 < b._y1) {
                    return 1;
                }
                if (a._y1 > b._y1) {
                    return -1;
                }
                return 0;
            });
        }
        if (cornerInversion[0] && !cornerInversion[1]) {
            this._fileList.sort((a, b) => {
                if (a._x1 < b._x1) {
                    return 1;
                }
                if (a._x1 > b._x1) {
                    return -1;
                }
                if (a._y1 < b._y1) {
                    return -1;
                }
                if (a._y1 > b._y1) {
                    return 1;
                }
                return 0;
            });
        }
        if (!cornerInversion[0] && cornerInversion[1]) {
            this._fileList.sort((a, b) => {
                if (a._x1 < b._x1) {
                    return -1;
                }
                if (a._x1 > b._x1) {
                    return 1;
                }
                if (a._y1 < b._y1) {
                    return 1;
                }
                if (a._y1 > b._y1) {
                    return -1;
                }
                return 0;
            });
        }
        this._reassignFilesToDesktop();
    }

    _sortAllFilesFromGridsByModifiedTime() {
        /**
         *
         * @param a
         * @param b
         */
        function byTime(a, b) {
            return a._modifiedTime - b._modifiedTime;
        }
        this._fileList.sort(byTime);
        this._reassignFilesToDesktop();
    }

    _sortAllFilesFromGridsBySize() {
        /**
         *
         * @param a
         * @param b
         */
        function bySize(a, b) {
            return a.fileSize - b.fileSize;
        }
        this._fileList.sort(bySize);
        this._reassignFilesToDesktop();
    }

    _sortAllFilesFromGridsByKind() {
        let specialFiles = [];
        let directoryFiles = [];
        let validDesktopFiles = [];
        let otherFiles = [];
        let newFileList = [];
        for (let fileItem of this._fileList) {
            if (fileItem._isSpecial) {
                specialFiles.push(fileItem);
                continue;
            }
            if (fileItem._isDirectory) {
                directoryFiles.push(fileItem);
                continue;
            }
            if (fileItem._isValidDesktopFile) {
                validDesktopFiles.push(fileItem);
                continue;
            } else {
                otherFiles.push(fileItem);
                continue;
            }
        }
        this._sortByName(specialFiles);
        this._sortByName(directoryFiles);
        this._sortByName(validDesktopFiles);
        this._sortByKindByName(otherFiles);
        newFileList.push(...specialFiles);
        newFileList.push(...validDesktopFiles);
        newFileList.push(...directoryFiles);
        newFileList.push(...otherFiles);
        if (this._fileList.length == newFileList.length) {
            this._fileList = newFileList;
        }
        this._reassignFilesToDesktop();
    }

    _reassignFilesToDesktop() {
        if (!this.sortSpecialFolders) {
            this._reassignFilesToDesktopPreserveSpecialFiles();
            return;
        }
        for (let fileItem of this._fileList) {
            fileItem.savedCoordinates = null;
            fileItem.dropCoordinates = null;
        }
        this._addFilesToDesktop(this._fileList, Enums.StoredCoordinates.ASSIGN);
    }

    _reassignFilesToDesktopPreserveSpecialFiles() {
        let specialFiles = [];
        let otherFiles = [];
        let newFileList = [];
        for (let fileItem of this._fileList) {
            if (fileItem._isSpecial) {
                specialFiles.push(fileItem);
                continue;
            }
            if (!fileItem._isSpecial) {
                otherFiles.push(fileItem);
                fileItem.savedCoordinates = null;
                fileItem.dropCoordinates = null;
                continue;
            }
        }
        newFileList.push(...specialFiles);
        newFileList.push(...otherFiles);
        if (this._fileList.length == newFileList.length) {
            this._fileList = newFileList;
        }
        this._addFilesToDesktop(this._fileList, Enums.StoredCoordinates.PRESERVE);
    }

    doSorts(cleargrids) {
        if (cleargrids) {
            this._fileList.map(f => f.removeFromGrid(false));
        }
        switch (Prefs.getSortOrder()) {
            case Enums.SortOrder.NAME:
                this._sortAllFilesFromGridsByName();
                break;
            case Enums.SortOrder.DESCENDINGNAME:
                this._sortAllFilesFromGridsByName(Enums.SortOrder.DESCENDINGNAME);
                break;
            case Enums.SortOrder.MODIFIEDTIME:
                this._sortAllFilesFromGridsByModifiedTime();
                break;
            case Enums.SortOrder.KIND:
                this._sortAllFilesFromGridsByKind();
                break;
            case Enums.SortOrder.SIZE:
                this._sortAllFilesFromGridsBySize();
                break;
            default:
                this._addFilesToDesktop(this._fileList, Enums.StoredCoordinates.PRESERVE);
                break;
        }
    }

    onToggleStackUnstackThisTypeClicked(type) {
        let unstackList = Prefs.getUnstackList();
        let typeInList = unstackList.includes(type);
        if (typeInList) {
            let index = unstackList.indexOf(type);
            unstackList.splice(index, 1);
        } else {
            unstackList.push(type);
        }
        Prefs.setUnstackList(unstackList);
    }
};
