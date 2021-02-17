import './AppMain.scss';
import * as Inferno from 'inferno';
import * as backend from '../backend';
import * as utils from '../utils';
import { FileTreePaneGui } from './FileTreePane';
import { BoxGui } from './Box';
import { EditorGui } from './Editor';
import { StatusBarGui } from './StatusBar';

declare global {
  // eslint-disable-next-line no-var
  var app: AppMainGui;
}

export interface AppMainCtx {
  backend: backend.Backend;
}

export class AppMainGui extends Inferno.Component<unknown, unknown> {
  public backend: backend.Backend;

  public constructor(props: unknown, context: unknown) {
    super(props, context);
    if ('app' in window) {
      throw new Error("Assertion failed: !('app' in window)");
    }
    window.app = this;
    // Proper initialization happens after the global reference has been
    // installed, so that if there is an exception thrown somewhere in the
    // constructor, I still could quickly diagnose the issue.

    this.backend = new backend.Backend();
  }

  public getChildContext(): AppMainCtx {
    return { backend: this.backend };
  }

  public componentDidMount(): void {
    (async () => {
      await this.backend.connect();
      while (true) {
        let { project_id } = (await this.backend.send_request({
          type: 'Project/open',
          dir: '/home/dmitmel/Projects/Rust/crosscode-localization-engine/tmp',
        })) as backend.ResponseMessageType & { type: 'Project/open' };
        await this.backend.send_request({ type: 'Project/close', project_id });
        await utils.wait(3000);
      }
    })();
  }

  public componentWillUnmount(): void {
    this.backend.disconnect();
  }

  public render(): JSX.Element {
    return (
      <BoxGui orientation="vertical" className="App">
        <BoxGui orientation="horizontal" className="BoxItem-expand">
          <FileTreePaneGui />
          <EditorGui />
        </BoxGui>
        <StatusBarGui />
      </BoxGui>
    );
  }
}
