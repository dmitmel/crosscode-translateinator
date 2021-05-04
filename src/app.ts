import { Backend, Fragment, Project, ProjectMeta } from './backend';
import { Event2 } from './events';
import * as gui from './gui';
import * as utils from './utils';

declare global {
  // eslint-disable-next-line no-var
  var __app__: AppMain | undefined;
}

export const TAB_NONE_INDEX = -3;
export const TAB_SEARCH_INDEX = -2;
export const TAB_QUEUE_INDEX = -1;

export class AppMain {
  public backend: Backend;

  public current_project: Project | null = null;
  public current_project_meta: ProjectMeta | null = null;
  public event_project_opened = new Event2();
  public event_project_closed = new Event2();

  public opened_files: OpenedFile[] = [];
  public event_file_opened = new Event2<[file: OpenedFile, index: number]>();
  public event_file_closed = new Event2<[file: OpenedFile, index: number]>();

  public current_tab_index: number = TAB_QUEUE_INDEX;
  public current_tab_opened_file: OpenedFile | null = null;
  public event_current_tab_change = new Event2();
  public set_current_tab_index(index: number): void {
    utils.assert(Number.isSafeInteger(index));
    if (!(index === TAB_NONE_INDEX || index === TAB_SEARCH_INDEX || index === TAB_QUEUE_INDEX)) {
      index = utils.clamp(index, 0, this.current_fragment_list.length - 1);
    }
    if (this.current_tab_index !== index) {
      this.current_tab_index = index;
      this.current_tab_opened_file = index < 0 ? null : this.opened_files[this.current_tab_index];
      this.event_current_tab_change.fire();
    }
  }

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
    utils.assert(!('__app__' in window));
    window.__app__ = this;
    // Proper initialization happens after the global reference has been
    // installed, so that if there is an exception thrown somewhere in the
    // constructor, I still could quickly diagnose the issue.

    this.backend = new Backend();
  }

  public async connect(): Promise<void> {
    await this.backend.connect();

    this.current_project = await Project.open(this.backend, 'tmp-tr-project');
    this.current_project_meta = await this.current_project.get_meta();
    this.event_project_opened.fire();

    for (let tab_file_path of [
      'data/maps/hideout/entrance.json',
      'data/database.json',
      'data/maps/bergen/bergen.json',
      'data/lang/sc/gui.en_US.json',
    ]) {
      let opened_file = new OpenedGameFile(this, tab_file_path);
      let index = this.opened_files.length;
      this.opened_files.push(opened_file);
      this.event_file_opened.fire(opened_file, index);
    }

    let file_path = 'data/maps/hideout/entrance.json';
    // let file_path = 'data/maps/rookie-harbor/center.json';
    // let file_path = 'data/item-database.json';
    this.current_fragment_list = await (
      await this.current_project.get_virtual_game_file(file_path)
    ).list_fragments();
    this.event_fragment_list_update.fire();

    this.set_current_tab_index(
      this.opened_files.findIndex((file) => file.path === 'data/maps/hideout/entrance.json'),
    );
  }

  public disconnect(): void {
    this.backend.disconnect();
  }
}

export enum OpenedFileType {
  TrFile,
  GameFile,
}

export abstract class OpenedFile {
  public abstract readonly type: OpenedFileType;

  public readonly gui_id: number = utils.new_gui_id();
  public constructor(public readonly app: AppMain, public readonly path: string) {}

  public get_name(): string {
    let idx = this.path.lastIndexOf('/');
    if (idx < 0) {
      return this.path;
    } else {
      return this.path.slice(idx + 1);
    }
  }

  public abstract list_fragments(start?: number | null, end?: number | null): Promise<Fragment[]>;
}

export class OpenedGameFile extends OpenedFile {
  public readonly type = OpenedFileType.GameFile;
  public async list_fragments(start?: number | null, end?: number | null): Promise<Fragment[]> {
    return (await this.app.current_project!.get_virtual_game_file(this.path)).list_fragments(
      start,
      end,
    );
  }
}
