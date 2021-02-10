import * as Inferno from 'inferno';
import './main.scss';

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
