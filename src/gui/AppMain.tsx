import './AppMain.scss';

import * as React from 'react';

import { AppMain } from '../app';
import { KeyCode, KeyMod, KeyStroke } from '../gui';
import { AppMainCtx } from './AppMainCtx';
import { HBoxGui, VBoxGui } from './Box';
import { EditorGui } from './Editor';
import { ExplorerGui } from './Explorer';
import { QuickActionsGui } from './QuickActions';
import { StatusBarGui } from './StatusBar';

export class AppMainGui extends React.Component<unknown, unknown> {
  public child_context: AppMainCtx = { app: new AppMain() };

  private key_bindings = new Map<number, () => void>();

  public override componentDidMount(): void {
    let { app } = this.child_context;
    void app.connect();

    let nw_window = nw.Window.get(window);
    nw_window.on('closed', this.on_nw_window_closing);

    window.addEventListener('beforeunload', this.on_before_page_unload);
    window.addEventListener('keydown', this.on_global_key_down, { capture: true });
    window.addEventListener('keyup', this.on_global_key_up, { capture: true });

    this.key_bindings.set(KeyMod.None | KeyCode.F5, () => {
      // Soft reload, caught by on_before_page_unload, although the callback is
      // purposefully not invoked manually here for me to be able to test if
      // even it works correctly, though I might change this in the future.
      window.location.reload();
    });

    this.key_bindings.set(KeyMod.Alt | KeyCode.F5, () => {
      // Hard reload, triggers a restart of all of nwjs' processes, also the OS
      // unloads the dynamic library without a way to intercept this.
      chrome.runtime.reload();
    });

    this.key_bindings.set(KeyMod.Cmd | KeyCode.KeyQ, () => {
      window.close();
    });

    this.key_bindings.set(KeyMod.Cmd | KeyCode.KeyP, () => {
      let { app } = this.child_context;
      app.event_quick_actions_pick.fire();
    });
  }

  public override componentWillUnmount(): void {
    let { app } = this.child_context;
    void app.disconnect();

    let nw_window = nw.Window.get(window);
    nw_window.removeListener('closed', this.on_nw_window_closing);

    window.removeEventListener('beforeunload', this.on_before_page_unload);
    window.removeEventListener('keydown', this.on_global_key_down, { capture: true });
    window.removeEventListener('keyup', this.on_global_key_up, { capture: true });
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
    let key = new KeyStroke(event);
    this.update_global_key_modifiers(key);
    if (event.isComposing || event.keyCode === 229) return;
    let action = this.key_bindings.get(key.encode());
    action?.();
  };

  private on_global_key_up = (event: KeyboardEvent): void => {
    let key = new KeyStroke(event);
    this.update_global_key_modifiers(key);
  };

  private update_global_key_modifiers(key: KeyStroke): void {
    let { app } = this.child_context;
    if (app.global_key_modifiers !== key.modifiers) {
      app.set_global_key_modifiers(key.modifiers);
    }
  }

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
