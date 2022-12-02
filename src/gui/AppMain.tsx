import './AppMain.scss';

import * as React from 'react';

import { AppMain } from '../app';
import { AppMainCtx } from './AppMainCtx';
import { HBoxGui, VBoxGui } from './Box';
import { EditorGui } from './Editor';
import { ExplorerGui } from './Explorer';
import { KeyCode, KeymapActionsLayer, KeymapHelper, KeyMod } from './keymap';
import { QuickActionsGui } from './QuickActions';
import { StatusBarGui } from './StatusBar';

export class AppMainGui extends React.Component<unknown, unknown> {
  public child_context: AppMainCtx = { app: new AppMain(), keymap: new KeymapHelper() };

  public root_keymap_layer = new KeymapActionsLayer();

  public override componentDidMount(): void {
    let { app } = this.child_context;
    void app.connect();

    let nw_window = nw.Window.get(window);
    nw_window.on('closed', this.on_nw_window_closing);

    window.addEventListener('beforeunload', this.on_before_page_unload);
    window.addEventListener('keydown', this.on_global_key_event_capture, true);
    window.addEventListener('keydown', this.on_global_key_event_bubble);
    window.addEventListener('keyup', this.on_global_key_event_capture, true);
    window.addEventListener('keyup', this.on_global_key_event_bubble);

    this.root_keymap_layer.add(KeyMod.None | KeyCode.F5, () => {
      // Soft reload, caught by on_before_page_unload, although the callback is
      // purposefully not invoked manually here for me to be able to test if
      // even it works correctly, though I might change this in the future.
      window.location.reload();
    });

    this.root_keymap_layer.add(KeyMod.Alt | KeyCode.F5, () => {
      // Hard reload, triggers a restart of all of nwjs' processes, also the OS
      // unloads the dynamic library without a way to intercept this.
      chrome.runtime.reload();
    });

    this.root_keymap_layer.add(KeyMod.Cmd | KeyCode.KeyQ, () => {
      window.close();
    });

    this.root_keymap_layer.add(KeyMod.Cmd | KeyCode.KeyP, () => {
      let { app } = this.child_context;
      app.event_quick_actions_pick.fire();
    });

    this.root_keymap_layer.add(KeyMod.Cmd | KeyCode.KeyW, () => {
      let { app } = this.child_context;
      app.close_tab(app.current_tab_index);
    });
  }

  public override componentWillUnmount(): void {
    let { app } = this.child_context;
    void app.disconnect();

    let nw_window = nw.Window.get(window);
    nw_window.removeListener('closed', this.on_nw_window_closing);

    window.removeEventListener('beforeunload', this.on_before_page_unload);
    window.removeEventListener('keydown', this.on_global_key_event_capture, true);
    window.removeEventListener('keydown', this.on_global_key_event_bubble);
    window.removeEventListener('keyup', this.on_global_key_event_capture, true);
    window.removeEventListener('keyup', this.on_global_key_event_bubble);
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

  private on_global_key_event_capture = (event: KeyboardEvent): void => {
    let { keymap } = this.child_context;
    keymap.prepare_event(event);
    if (event.type === 'keydown') {
      keymap.add_layer_to_event(event, this.root_keymap_layer);
    }
  };

  private on_global_key_event_bubble = (event: KeyboardEvent): void => {
    let { keymap } = this.child_context;
    keymap.process_event_actions(event);
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
