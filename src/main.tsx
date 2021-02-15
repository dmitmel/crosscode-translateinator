import './uncaught_exception';

import * as Inferno from 'inferno';
import './main.scss';
import * as backend from './backend';
import * as utils from './utils';

(async () => {
  let bk = new backend.Backend();
  Object.assign(window, { backend: bk });
  await bk.connect();
  while (true) {
    let { project_id } = (await bk.send_request({
      type: 'Project/open',
      dir: '/home/dmitmel/Projects/Rust/crosscode-localization-engine/tmp',
    })) as backend.ResponseMessageType & { type: 'Project/open' };
    await bk.send_request({ type: 'Project/close', project_id });
    await utils.wait(3000);
  }
})();

class CounterComponent extends Inferno.Component<unknown, { counter: number }> {
  public state = { counter: 1 };

  public constructor(props: unknown, context: unknown) {
    super(props, context);
    this.onButtonClick = this.onButtonClick.bind(this);
  }

  public render(): JSX.Element {
    return (
      <div class="Counter">
        <h2>{this.state.counter}</h2>
        <button onClick={this.onButtonClick}>+1</button>
      </div>
    );
  }

  public onButtonClick(_event: Inferno.InfernoMouseEvent<HTMLButtonElement>): void {
    this.setState({ counter: this.state.counter + 1 });
  }
}

Inferno.render(<CounterComponent />, document.getElementById('app'));
