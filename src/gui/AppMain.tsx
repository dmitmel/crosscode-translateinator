import './AppMain.scss';

import * as React from 'react';

import { AppMain } from '../app';
import * as gui from '../gui';
import { AppMainCtx } from './AppMainCtx';
import { BoxGui } from './Box';
import { EditorGui } from './Editor';
import { ExplorerGui } from './Explorer';
import { StatusBarGui } from './StatusBar';

export class AppMainGui extends React.Component<unknown, unknown> {
  public child_context: AppMainCtx = { app: new AppMain() };

  public override componentDidMount(): void {
    nw.Window.get(window).on('closed', this.on_nw_window_closing);
    window.addEventListener('beforeunload', this.on_before_page_unload);
    window.addEventListener('keydown', this.on_global_key_down);
    window.addEventListener('keyup', this.on_global_key_up);
    let { app } = this.child_context;
    void app.connect();
  }

  public override componentWillUnmount(): void {
    nw.Window.get(window).removeListener('closed', this.on_nw_window_closing);
    window.removeEventListener('beforeunload', this.on_before_page_unload);
    window.removeEventListener('keydown', this.on_global_key_down);
    window.removeEventListener('keyup', this.on_global_key_up);
    let { app } = this.child_context;
    void app.disconnect();
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
    app.set_global_key_modifiers(kmod);
  };

  private on_global_key_up = (event: KeyboardEvent): void => {
    let { app } = this.child_context;
    let key = event.code;
    let kmod = gui.get_keyboard_event_modifiers(event);
    app.set_global_key_modifiers(kmod);

    if (key === 'F5' && kmod === gui.KeyMod.None) {
      // Soft reload, caught by on_before_page_unload, although the callback is
      // purposefully not invoked manually here for me to be able to test if
      // even it works correctly, though I might change this in the future.
      window.location.reload();
    } else if (key === 'F5' && kmod === gui.KeyMod.Alt) {
      // Hard reload, triggers a restart of all of nwjs' processes, also the OS
      // unloads the dynamic library without a way to intercept this.
      chrome.runtime.reload();
    }
  };

  public override render(): React.ReactNode {
    return (
      <AppMainCtx.Provider value={this.child_context}>
        <div className="App">
          <BoxGui className="App-MainLayout" orientation="vertical">
            <BoxGui orientation="horizontal" className="BoxItem-expand">
              <ExplorerGui />
              <EditorGui className="BoxItem-expand" />
            </BoxGui>
            <StatusBarGui />
          </BoxGui>
        </div>
      </AppMainCtx.Provider>
    );
  }
}
