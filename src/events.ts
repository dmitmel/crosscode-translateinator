export class Event2<Args extends unknown[] = []> {
  public listeners = new Set<(...args: Args) => void>();

  public on(listener: (...args: Args) => void): void {
    this.listeners.add(listener);
  }

  public once(listener: (...args: Args) => void): void {
    let self = this;
    this.listeners.add(function listenerOnce(this: unknown, ...args: Args): void {
      self.listeners.delete(listenerOnce);
      return listener.apply(this, args);
    });
  }

  public off(listener: (...args: Args) => void): void {
    this.listeners.delete(listener);
  }

  public fire(...args: Args): void {
    let listeners_copy = new Set(this.listeners);
    for (let listener of listeners_copy) {
      listener(...args);
    }
  }
}
