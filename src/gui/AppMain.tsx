import './AppMain.scss';
import * as Inferno from 'inferno';
import * as backend from '../backend';
import { ProjectTreeGui } from './ProjectTree';
import { BoxGui } from './Box';
import { EditorGui } from './Editor';
import { StatusBarGui } from './StatusBar';
import { Event2 } from '../events';

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
    void this.inner.connect();
  }

  public componentWillUnmount(): void {
    nw.Window.get(window).removeListener('closed', this.on_nw_window_closing);
    window.removeEventListener('beforeunload', this.on_before_page_unload);
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

  public render(): JSX.Element {
    return (
      <BoxGui orientation="vertical" className="App">
        <BoxGui orientation="horizontal" className="BoxItem-expand">
          <ProjectTreeGui />
          <EditorGui className="BoxItem-expand" />
        </BoxGui>
        <StatusBarGui />
      </BoxGui>
    );
  }
}

declare global {
  // eslint-disable-next-line no-var
  var app: AppMain;
}

export class AppMain {
  public backend: backend.Backend;
  public current_project_id: number | null = null;
  public current_project_meta: { translation_locale: string } | null = null;
  public events = {
    project_opened: new Event2(),
    project_closed: new Event2(),
  };

  public constructor() {
    if ('app' in window) {
      throw new Error("Assertion failed: !('app' in window)");
    }
    window.app = this;
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

    this.events.project_opened.fire();
  }

  public disconnect(): void {
    this.backend.disconnect();
  }
}
