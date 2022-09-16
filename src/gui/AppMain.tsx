import './AppMain.scss';

import * as React from 'react';

import { AppMain } from '../app';
import * as gui from '../gui';
import { AppMainCtx } from './AppMainCtx';
import { HBoxGui, VBoxGui } from './Box';
import { EditorGui } from './Editor';
import { ExplorerGui } from './Explorer';
import { QuickActionsGui } from './QuickActions';
import { StatusBarGui } from './StatusBar';

export const SOURCE_CODE_URL = 'https://github.com/dmitmel/crosscode-translateinator';
export const BUG_TRACKER_URL = `${SOURCE_CODE_URL}/issues`;

export class AppMainGui extends React.Component<unknown, unknown> {
  public child_context: AppMainCtx = { app: new AppMain() };

  public override componentDidMount(): void {
    let { app } = this.child_context;
    void app.connect();

    let nw_window = nw.Window.get(window);
    nw_window.on('closed', this.on_nw_window_closing);

    window.addEventListener('beforeunload', this.on_before_page_unload);
    window.addEventListener('keydown', this.on_global_key_down, { capture: true });
    window.addEventListener('keyup', this.on_global_key_up, { capture: true });

    // TODO: menubar.createMacBuiltin()
    let ctrl_key = process.platform === 'darwin' ? 'cmd' : 'ctrl';
    let menubar = construct_menu({
      type: 'menubar',
      items: [
        //

        {
          label: 'File',
          submenu: [
            //

            {
              label: 'New Project',
              enabled: false,
            },

            {
              label: 'Open Project',
              enabled: false,
            },

            {
              label: 'Close Project',
              enabled: false,
            },

            { type: 'separator' },

            {
              label: 'Import Files',
              enabled: false,
            },

            {
              label: 'Export Files',
              enabled: false,
            },

            {
              label: 'Statistics',
              enabled: false,
            },

            {
              label: 'Project Preferences',
              enabled: false,
              modifiers: ctrl_key,
              key: ';',
            },

            {
              label: 'Preferences',
              enabled: false,
              modifiers: ctrl_key,
              key: ',',
            },

            { type: 'separator' },

            {
              label: 'Reload',
              key: 'F5',
              click: () => {
                // Soft reload, caught by on_before_page_unload, although the
                // callback is purposefully not invoked manually here for me to
                // be able to test if even it works correctly, though I might
                // change this in the future.
                window.location.reload();
              },
            },

            {
              label: 'Full Restart',
              modifiers: 'alt',
              key: 'F5',
              click: () => {
                // Hard reload, triggers a restart of all of nwjs' processes,
                // also the OS unloads the dynamic library without a way to
                // intercept this.
                chrome.runtime.reload();
              },
            },

            {
              label: 'Exit',
              modifiers: ctrl_key,
              key: 'q',
              click: () => {
                window.close();
              },
            },

            //
          ],
        },

        {
          label: 'Edit',
          submenu: [],
        },

        {
          label: 'View',
          submenu: [],
        },

        {
          label: 'Help',
          submenu: [
            {
              label: 'Source Code',
              click: () => {
                nw.Shell.openExternal(SOURCE_CODE_URL);
              },
            },
            {
              label: 'Report Bugs',
              click: () => {
                nw.Shell.openExternal(BUG_TRACKER_URL);
              },
            },
          ],
        },

        //
      ],
    });
    nw_window.menu = menubar;
  }

  public override componentWillUnmount(): void {
    let { app } = this.child_context;
    void app.disconnect();

    let nw_window = nw.Window.get(window);
    nw_window.removeListener('closed', this.on_nw_window_closing);

    window.removeEventListener('beforeunload', this.on_before_page_unload);
    window.removeEventListener('keydown', this.on_global_key_down, { capture: true });
    window.removeEventListener('keyup', this.on_global_key_up, { capture: true });

    nw_window.menu = null;
  }

  private on_before_page_unload = (): void => {
    let { app } = this.child_context;
    void app.disconnect();
  };

  private on_nw_window_closing = (): void => {
    let { app } = this.child_context;
    // TODO: Warn the user on unsaved changes, etc.
    void app.disconnect();
    // TODO: The actual window closing can be delayed, we should probably wait
    // for the backend thread to really stop before finally exiting.
    nw.Window.get(window).close(true);
  };

  private on_global_key_down = (event: KeyboardEvent): void => {
    let { app } = this.child_context;
    let kmod = gui.get_keyboard_event_modifiers(event);
    if (app.global_key_modifiers !== kmod) {
      app.set_global_key_modifiers(kmod);
    }
  };

  private on_global_key_up = (event: KeyboardEvent): void => {
    let { app } = this.child_context;
    let kmod = gui.get_keyboard_event_modifiers(event);
    if (app.global_key_modifiers !== kmod) {
      app.set_global_key_modifiers(kmod);
    }
  };

  public override render(): React.ReactNode {
    return (
      <AppMainCtx.Provider value={this.child_context}>
        <div className="App">
          <VBoxGui className="App-MainLayout">
            <HBoxGui className="BoxItem-expand">
              <ExplorerGui />
              <EditorGui className="BoxItem-expand" />
            </HBoxGui>
            <StatusBarGui />
          </VBoxGui>
          <QuickActionsGui />
        </div>
      </AppMainCtx.Provider>
    );
  }
}

export interface ConstructMenuConfig {
  type: 'menubar' | 'contextmenu';
  id?: string;
  items: ConstructMenuItemConfig[];
  out_menus?: Record<string, nw.Menu>;
  out_menu_items?: Record<string, nw.MenuItem>;
}

export interface ConstructMenuItemConfig extends Omit<nw.MenuItem.Options, 'submenu'> {
  id?: string;
  submenu?: ConstructMenuConfig | ConstructMenuItemConfig[];
}

export function construct_menu(menu_options: ConstructMenuConfig): nw.Menu {
  let menu = new nw.Menu({ type: menu_options.type });
  if (menu_options.out_menus != null && menu_options.id != null) {
    menu_options.out_menus[menu_options.id] = menu;
  }
  for (let item_options of menu_options.items) {
    let { submenu: submenu_options, ...only_item_options } = item_options;
    let real_item_options: nw.MenuItem.Options = only_item_options;
    if (Array.isArray(submenu_options)) {
      real_item_options.submenu = construct_menu({
        type: 'contextmenu', // The default (according to documentation)
        items: submenu_options,
        out_menus: menu_options.out_menus,
        out_menu_items: menu_options.out_menu_items,
      });
    } else if (submenu_options != null) {
      real_item_options.submenu = construct_menu({
        out_menus: menu_options.out_menus,
        out_menu_items: menu_options.out_menu_items,
        ...submenu_options,
      });
    }
    let item = new nw.MenuItem(real_item_options);
    if (menu_options.out_menu_items != null && item_options.id != null) {
      menu_options.out_menu_items[item_options.id] = item;
    }
    menu.append(item);
  }
  return menu;
}
