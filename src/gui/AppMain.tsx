import './AppMain.scss';

import * as Inferno from 'inferno';

import * as backend from '../backend';
import { Event2 } from '../events';
import * as gui from '../gui';
import * as utils from '../utils';
import { BoxGui } from './Box';
import { EditorGui } from './Editor';
import { ProjectTreeGui } from './ProjectTree';
import { StatusBarGui } from './StatusBar';

export interface AppMainGuiCtx {
  app: AppMain;
}

export class AppMainGui extends Inferno.Component<unknown, unknown> {
  public inner = new AppMain();

  public getChildContext(): AppMainGuiCtx {
    return { app: this.inner };
  }

  public componentDidMount(): void {
    nw.Window.get(window).on('closed', this.on_nw_window_closing);
    window.addEventListener('beforeunload', this.on_before_page_unload);
    window.addEventListener('keydown', this.on_global_key_down);
    window.addEventListener('keyup', this.on_global_key_up);
    void this.inner.connect();
  }

  public componentWillUnmount(): void {
    nw.Window.get(window).removeListener('closed', this.on_nw_window_closing);
    window.removeEventListener('beforeunload', this.on_before_page_unload);
    window.removeEventListener('keydown', this.on_global_key_down);
    window.removeEventListener('keyup', this.on_global_key_up);
    void this.inner.disconnect();
  }

  private on_before_page_unload = (): void => {
    this.inner.disconnect();
  };

  private on_nw_window_closing = (): void => {
    // TODO: Warn the user on unsaved changes, etc.
    this.inner.disconnect();
    // TODO: The actual window closing can be delayed, we should probably wait
    // for the backend thread to really stop before finally exiting.
    nw.Window.get(window).close(true);
  };

  private on_global_key_down = (event: KeyboardEvent): void => {
    let kmod = gui.get_keyboard_event_modifiers(event);
    this.inner.set_global_key_modifiers(kmod);
  };

  private on_global_key_up = (event: KeyboardEvent): void => {
    let key = event.code;
    let kmod = gui.get_keyboard_event_modifiers(event);
    this.inner.set_global_key_modifiers(kmod);

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

  public render(): JSX.Element {
    return (
      <div className="App">
        <BoxGui className="App-MainLayout" orientation="vertical">
          <BoxGui orientation="horizontal" className="BoxItem-expand">
            <ProjectTreeGui />
            <EditorGui className="BoxItem-expand" />
          </BoxGui>
          <StatusBarGui />
        </BoxGui>
      </div>
    );
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __app__: AppMain;
}

export class AppMain {
  public backend: backend.Backend;

  public current_project_id: number | null = null;
  public current_project_meta: { translation_locale: string } | null = null;
  public event_project_opened = new Event2();
  public event_project_closed = new Event2();

  public current_fragment_list: Array<backend.ListedFragment & { file: string }> = [];
  public current_fragment_pos = 0; // TODO: save a position per each tab
  public event_current_fragment_change = new Event2<[jump: boolean]>();
  public set_current_fragment_pos(pos: number, jump: boolean): void {
    utils.assert(Number.isSafeInteger(pos));
    pos = utils.clamp(pos, 1, this.current_fragment_list.length);
    if (this.current_fragment_pos !== pos) {
      this.current_fragment_pos = pos;
      this.event_current_fragment_change.fire(jump);
    }
  }

  public global_key_modifiers = gui.KeyMod.None;
  public event_global_key_modifiers_change = new Event2<[state: gui.KeyMod]>();
  public set_global_key_modifiers(state: gui.KeyMod): void {
    if (this.global_key_modifiers !== state) {
      this.global_key_modifiers = state;
      this.event_global_key_modifiers_change.fire(state);
    }
  }

  public constructor() {
    utils.assert(!('app' in window));
    window.__app__ = this;
    // Proper initialization happens after the global reference has been
    // installed, so that if there is an exception thrown somewhere in the
    // constructor, I still could quickly diagnose the issue.

    this.backend = new backend.Backend();
  }

  public async connect(): Promise<void> {
    await this.backend.connect();

    {
      let response = await this.backend.send_request<'Project/open'>({
        type: 'Project/open',
        dir: '/home/dmitmel/Projects/Rust/crosscode-localization-engine/tmp',
      });
      this.current_project_id = response.project_id;
    }

    {
      let response = await this.backend.send_request<'Project/get_meta'>({
        type: 'Project/get_meta',
        project_id: this.current_project_id,
      });
      this.current_project_meta = {
        translation_locale: response.translation_locale,
      };
    }

    {
      let file_path = 'data/maps/hideout/entrance.json';
      // let file_path = 'data/maps/rookie-harbor/center.json';
      // let file_path = 'data/item-database.json';
      let response = await __app__.backend.send_request({
        type: 'VirtualGameFile/list_fragments',
        project_id: __app__.current_project_id!,
        file_path,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.current_fragment_list = response.fragments as any;
      for (let fragment of this.current_fragment_list) {
        fragment.file = file_path;
      }
    }

    this.event_project_opened.fire();
  }

  public disconnect(): void {
    this.backend.disconnect();
  }
}
