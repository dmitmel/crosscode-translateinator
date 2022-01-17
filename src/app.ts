import { Backend, Fragment, Project, ProjectMeta, VirtualGameFile } from './backend';
import { Event2 } from './events';
import * as gui from './gui';
import * as utils from './utils';

declare global {
  // eslint-disable-next-line no-var
  var __app__: AppMain;
  // eslint-disable-next-line no-var
  var __crosscode_translation_tool__: true;
}

export class AppMain {
  public backend: Backend;

  public constructor() {
    utils.assert(!('__app__' in window));
    window.__app__ = this;
    // Proper initialization happens after the global reference has been
    // installed, so that if there is an exception thrown somewhere in the
    // constructor, I still could quickly diagnose the issue.

    this.backend = new Backend();

    // Install a marker variable, so that the game window can find us.
    window.__crosscode_translation_tool__ = true;
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

    this.open_file(FileType.GameFile, 'data/maps/hideout/entrance.json');
    this.open_file(FileType.GameFile, 'data/database.json');
    this.open_file(FileType.GameFile, 'data/maps/bergen/bergen.json');
    this.open_file(FileType.GameFile, 'data/lang/sc/gui.en_US.json');
    this.open_file(FileType.GameFile, 'data/maps/rookie-harbor/center.json');
    this.open_file(FileType.GameFile, 'data/item-database.json');

    this.open_file(FileType.GameFile, 'data/maps/hideout/entrance.json');
  }

  public disconnect(): void {
    this.backend.disconnect();
  }

  public current_project: Project | null = null;
  public current_project_meta: ProjectMeta | null = null;
  public event_project_opened = new Event2();
  public event_project_closed = new Event2();

  public project_game_files_tree = new FileTree();
  public project_tr_files_tree = new FileTree();

  public queue = new TabQueue(this);
  public search = new TabSearch(this);
  public opened_tabs: EditorTab[] = [this.queue, this.search];
  public event_tab_opened = new Event2<[tab: EditorTab, index: number]>();
  public event_tab_closed = new Event2<[tab: EditorTab, index: number]>();

  public current_tab_index = 0;
  public current_tab: EditorTab | null = this.opened_tabs[this.current_tab_index];
  public event_current_tab_change = new Event2<[trigger: TabChangeTrigger | null]>();
  private current_tab_loading_promise: Promise<void> | null = null;

  public set_current_tab_index(index: number, trigger: TabChangeTrigger | null = null): void {
    utils.assert(Number.isSafeInteger(index));
    index = this.clamp_tab_index(index);
    if (this.current_tab_index !== index) {
      this.current_tab_index = index;
      let tab = this.opened_tabs[this.current_tab_index];
      this.current_tab = tab;
      this.event_current_tab_change.fire(trigger);

      // TODO: handle cancellation, the current tab being closed, etc etc
      this.current_tab_loading_promise = (async () => {
        await this.current_tab_loading_promise;
        await tab.loaded_promise;
        let list = await tab.list_fragments();
        this.current_tab_loading_promise = null;
        if (this.current_tab_index === this.opened_tabs.indexOf(tab)) {
          this.current_fragment_list = list;
          this.event_fragment_list_update.fire();
        }
      })();
    }
  }

  public clamp_tab_index(index: number): number {
    return Math.max(0, utils.clamp(Math.floor(index), 0, this.opened_tabs.length - 1));
  }

  // public create_game_file_tab(path: string): TabFile {
  //   return new TabGameFile(this, path);
  // }

  // public create_tr_file_tab(path: string): TabFile {
  //   return new TabTrFile(this, path);
  // }

  public open_file(ft: FileType, path: string, trigger: TabChangeTrigger | null = null): void {
    let index = this.opened_tabs.findIndex(
      (tab) => tab instanceof TabFile && tab.file_type === ft && tab.file_path === path,
    );
    if (index < 0) {
      let tab: TabFile;
      if (ft === FileType.GameFile) {
        tab = new TabGameFile(this, path);
      } else if (ft === FileType.TrFile) {
        tab = new TabTrFile(this, path);
      } else {
        throw new Error('unreachable');
      }
      index = this.opened_tabs.length;
      this.opened_tabs.push(tab);
      this.event_tab_opened.fire(tab, index);
    }
    this.set_current_tab_index(index, trigger);
  }

  public close_tab(index: number): void {
    let tab = this.opened_tabs[index];
    utils.assert(tab != null);
    if (!tab.is_closeable()) return;
    this.opened_tabs.splice(index, 1);
    this.event_tab_closed.fire(tab, index);
    this.set_current_tab_index(this.current_tab_index - (this.current_tab_index > index ? 1 : 0));
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

  // Fragments received from the game window are queued and processed
  // asynchronously to not block the UI thread of the other window, especially
  // when re-rendering the UI in this one, and also because I'm not sure how
  // safe is calling a function from a different JS context.
  public received_fragments_tmp_queue: FragmentFromGame[] = [];
  public received_fragments_timer_id = -1;
  // This function will be invoked from the game window by the connector mod.
  public receive_fragments_from_game(fragments: FragmentFromGame[]): void {
    for (let i = 0, len = fragments.length; i < len; i++) {
      this.received_fragments_tmp_queue.push(fragments[i]);
    }
    if (this.received_fragments_timer_id < 0) {
      let timer = setTimeout(() => {
        clearTimeout(timer);
        this.received_fragments_timer_id = -1;
        void this.queue.push_fragments_from_game(this.received_fragments_tmp_queue);
        this.received_fragments_tmp_queue.length = 0;
      });
      // Cast the timer ID to a number to avoid fighting the TS compiler:
      // NodeJS'es typedefs state that setTimeout returns an instance of
      // NodeJS.Timeout.
      this.received_fragments_timer_id = Number(timer);
    }
  }
}

export enum TabChangeTrigger {
  FileTree,
  TabList,
}

export abstract class EditorTab {
  public readonly loaded_promise: Promise<void> | null = null;
  public current_fragment_index = 0;

  public constructor(public readonly app: AppMain) {}

  public is_closeable(): boolean {
    return true;
  }

  // TODO: check that the returned list has exactly the requested size
  public abstract list_fragments(start?: number | null, end?: number | null): Promise<Fragment[]>;
}

export interface FragmentFromGame {
  file_path: string;
  json_path: string;
}

export class TabQueue extends EditorTab {
  // TODO: This should be configurable in the UI.
  public static readonly MAX_SIZE: number = 200;

  public fragments: Fragment[] = [];

  public async push_fragments_from_game(list: FragmentFromGame[]): Promise<void> {
    list = list.slice(); // backup the list before any asynchronousity happens
    let fragments_by_file_path = new Map<string, number[]>();
    let fetched_list: Array<Fragment | undefined> = new Array(list.length);
    for (let i = 0, len = list.length; i < len; i++) {
      utils.map_set_default(fragments_by_file_path, list[i].file_path, []).push(i);
    }
    let promises: Array<Promise<void>> = [];
    for (let [file_path, indexes] of fragments_by_file_path) {
      promises.push(
        (async () => {
          let game_file = await this.app.current_project!.get_virtual_game_file(file_path);
          for (let idx of indexes) {
            fetched_list[idx] = await game_file.get_fragment(list[idx].json_path);
          }
        })(),
      );
    }
    await Promise.all(promises);
    this.push_fragments(fetched_list.filter((f) => f != null) as Fragment[]);
  }

  public push_fragments(list: Fragment[]): void {
    let queue = this.fragments;
    if (queue.length + list.length > TabQueue.MAX_SIZE) {
      queue.splice(0, queue.length + list.length - TabQueue.MAX_SIZE);
    }
    let start = Math.max(0, list.length - TabQueue.MAX_SIZE);
    for (let i = start, len = list.length; i < len; i++) {
      queue.push(list[i]);
    }
    if (this.app.current_tab_index === this.app.opened_tabs.indexOf(this)) {
      this.app.current_fragment_list = this.list_fragments_(0, this.fragments.length);
      this.app.event_fragment_list_update.fire();
    }
  }

  public override is_closeable(): boolean {
    return false;
  }

  private list_fragments_(start: number, end: number): Fragment[] {
    let list = this.fragments;
    start ??= 0;
    let len = list.length;
    end ??= len;
    let result: Fragment[] = [];
    for (let i = end; i > start; i--) {
      result.push(list[i - 1]);
    }
    return result;
  }

  public list_fragments(start?: number | null, end?: number | null): Promise<Fragment[]> {
    return Promise.resolve(this.list_fragments_(start ?? 0, end ?? this.fragments.length));
  }
}

export class TabSearch extends EditorTab {
  public override is_closeable(): boolean {
    return false;
  }

  public async list_fragments(_start?: number | null, _end?: number | null): Promise<Fragment[]> {
    return [];
  }
}

export enum FileType {
  TrFile,
  GameFile,
}

export abstract class TabFile extends EditorTab {
  public abstract readonly file_type: FileType;

  public constructor(app: AppMain, public readonly file_path: string) {
    super(app);
  }

  public get_file_name(): string {
    let idx = this.file_path.lastIndexOf('/');
    if (idx < 0) {
      return this.file_path;
    } else {
      return this.file_path.slice(idx + 1);
    }
  }
}

export class TabGameFile extends TabFile {
  public readonly file_type = FileType.GameFile;

  public virtual_game_file: VirtualGameFile | null = null;
  public override readonly loaded_promise: Promise<void>;

  public constructor(app: AppMain, path: string) {
    super(app, path);
    this.loaded_promise = (async () => {
      this.virtual_game_file = await this.app.current_project!.get_virtual_game_file(
        this.file_path,
      );
    })();
  }

  public async list_fragments(start?: number | null, end?: number | null): Promise<Fragment[]> {
    return this.virtual_game_file!.list_fragments(start, end);
  }
}

export class TabTrFile extends TabFile {
  public readonly file_type = FileType.TrFile;

  public async list_fragments(start?: number | null, end?: number | null): Promise<Fragment[]> {
    return [];
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
