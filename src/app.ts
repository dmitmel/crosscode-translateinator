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
    this.project_tr_files_tree.clear();
    this.project_tr_files_tree.add_paths(await this.current_project.list_tr_file_paths());
    this.project_game_files_tree.clear();
    this.project_game_files_tree.add_paths(await this.current_project.list_game_file_paths());

    this.event_project_opened.fire();

    this.open_game_file('data/maps/hideout/entrance.json');
    this.open_game_file('data/database.json');
    this.open_game_file('data/maps/bergen/bergen.json');
    this.open_game_file('data/lang/sc/gui.en_US.json');

    this.open_game_file('data/maps/hideout/entrance.json');

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

  public current_project: Project | null = null;
  public current_project_meta: ProjectMeta | null = null;
  public event_project_opened = new Event2();
  public event_project_closed = new Event2();

  public project_game_files_tree: FileTree = new FileTree();
  public project_tr_files_tree: FileTree = new FileTree();

  public opened_files: OpenedFile[] = [];
  public event_file_opened = new Event2<[file: OpenedFile, index: number]>();
  public event_file_closed = new Event2<[file: OpenedFile, index: number]>();

  public current_tab_index: number = TAB_QUEUE_INDEX;
  public current_tab_opened_file: OpenedFile | null = null;
  public event_current_tab_change = new Event2<[triggered_from_tree: boolean]>();
  public set_current_tab_index(index: number, triggered_from_tree = false): void {
    utils.assert(Number.isSafeInteger(index));
    if (!(index === TAB_NONE_INDEX || index === TAB_SEARCH_INDEX || index === TAB_QUEUE_INDEX)) {
      index = utils.clamp(index, 0, this.opened_files.length - 1);
    }
    if (this.current_tab_index !== index) {
      this.current_tab_index = index;
      this.current_tab_opened_file = index < 0 ? null : this.opened_files[this.current_tab_index];
      this.event_current_tab_change.fire(triggered_from_tree);
    }
  }

  public open_game_file(path: string, triggered_from_tree = false): void {
    let index = this.opened_files.findIndex((file) => file.path === path);
    if (index < 0) {
      let opened_file = new OpenedGameFile(this, path);
      index = this.opened_files.length;
      this.opened_files.push(opened_file);
      this.event_file_opened.fire(opened_file, index);
    }
    this.set_current_tab_index(index, triggered_from_tree);
  }

  public close_game_file(index: number): void {
    if (index < 0) return;
    let opened_file = this.opened_files[index];
    if (opened_file != null) {
      this.opened_files.splice(index, 1);
      this.event_file_closed.fire(opened_file, index);
    }
    this.set_current_tab_index(
      utils.clamp(this.current_tab_index, 0, this.opened_files.length - 1),
    );
  }

  public current_fragment_list: Fragment[] = [];
  public fragment_list_slice_start = 0;
  public fragment_list_slice_end = 10;
  public event_fragment_list_update = new Event2();
  public get_current_fragment_list_slice(): Fragment[] {
    return this.current_fragment_list.slice(
      this.fragment_list_slice_start,
      this.fragment_list_slice_end,
    );
  }

  public current_fragment_index = -1; // TODO: save a position per each tab
  public event_current_fragment_change = new Event2<[jump: boolean]>();
  public set_current_fragment_index(index: number, jump: boolean): void {
    utils.assert(Number.isSafeInteger(index));
    index = utils.clamp(index, 0, this.current_fragment_list.length - 1);
    if (this.current_fragment_index !== index) {
      this.current_fragment_index = index;
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
}

export enum OpenedFileType {
  TrFile,
  GameFile,
}

export abstract class OpenedFile {
  public abstract readonly type: OpenedFileType;

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

export class FileTree {
  public static readonly ROOT_DIR = '';

  public readonly dirs = new Map<string, FileTreeDir>();
  public readonly files = new Map<string, FileTreeFile>();

  public get root_dir(): FileTreeDir {
    let root_dir = this.dirs.get(FileTree.ROOT_DIR);
    utils.assert(root_dir != null);
    return root_dir;
  }

  public constructor() {
    this.clear();
  }

  public clear(): void {
    this.dirs.clear();
    this.files.clear();

    let root_dir = new FileTreeDir(FileTree.ROOT_DIR);
    this.dirs.set(root_dir.path, root_dir);
  }

  public add_paths(paths: string[]): void {
    for (let path of paths) {
      let parent_dir = this.root_dir;

      let component_start = 0;
      while (component_start < path.length) {
        let sep_index = path.indexOf('/', component_start);
        let is_last = sep_index < 0;
        let component_end = is_last ? path.length : sep_index;
        let component_path = path.slice(0, component_end);
        component_start = component_end + 1;

        parent_dir.children.add(component_path);
        if (is_last) {
          let file = new FileTreeFile(component_path);
          this.files.set(component_path, file);
        } else {
          let dir = this.dirs.get(component_path);
          if (dir == null) {
            dir = new FileTreeDir(component_path);
            this.dirs.set(dir.path, dir);
          }
          parent_dir = dir;
        }
      }
    }
  }
}

export class FileTreeFile {
  public constructor(public readonly path: string) {}

  public get name(): string {
    let idx = this.path.lastIndexOf('/');
    if (idx < 0) {
      return this.path;
    } else {
      return this.path.slice(idx + 1);
    }
  }
}

export class FileTreeDir extends FileTreeFile {
  public readonly children = new Set<string>();
}
