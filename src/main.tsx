import * as Inferno from 'inferno';
import './main.scss';

class CounterComponent extends Inferno.Component<unknown, { counter: number }> {
  public state = { counter: 1 };

  constructor(props: unknown, context: unknown) {
    super(props, context);
    this.onButtonClick = this.onButtonClick.bind(this);
  }

  render() {
    return (
      <div class="Counter">
        <h2>{this.state.counter}</h2>
        <button onClick={this.onButtonClick}>+1</button>
      </div>
    );
  }

  onButtonClick(_event: Inferno.InfernoMouseEvent<HTMLButtonElement>) {
    this.setState({ counter: this.state.counter + 1 });
  }
}

Inferno.render(<CounterComponent />, document.getElementById('app'));
