import { Backend, Fragment, Project, ProjectMeta } from './backend';
import { Event2 } from './events';
import * as gui from './gui';
import * as utils from './utils';

export class AppMain {
  public backend: Backend;

  public current_project: Project | null = null;
  public current_project_meta: ProjectMeta | null = null;
  public event_project_opened = new Event2();
  public event_project_closed = new Event2();

  public current_fragment_list: Fragment[] = [];
  public event_fragment_list_update = new Event2();

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

    this.backend = new Backend();
  }

  public async connect(): Promise<void> {
    await this.backend.connect();

    this.current_project = await Project.open(
      this.backend,
      '/home/dmitmel/Projects/Rust/crosscode-localization-engine/tmp',
    );
    this.current_project_meta = await this.current_project.get_meta();
    this.event_project_opened.fire();

    let file_path = 'data/maps/hideout/entrance.json';
    // let file_path = 'data/maps/rookie-harbor/center.json';
    // let file_path = 'data/item-database.json';
    this.current_fragment_list = await (
      await this.current_project.get_virtual_game_file(file_path)
    ).list_fragments();
    this.event_fragment_list_update.fire();
  }

  public disconnect(): void {
    this.backend.disconnect();
  }
}
