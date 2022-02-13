import * as backend from './backend';
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
  public backend: backend.Backend;

  public constructor() {
    utils.assert(!('__app__' in window));
    window.__app__ = this;
    // Proper initialization happens after the global reference has been
    // installed, so that if there is an exception thrown somewhere in the
    // constructor, I still could quickly diagnose the issue.

    this.backend = new backend.Backend();

    // Install a marker variable, so that the game window can find us.
    window.__crosscode_translation_tool__ = true;
  }

  public async connect(): Promise<void> {
    await this.backend.connect();

    this.current_project = await Project.open(this.backend, 'tmp-tr-project');
    this.current_project_meta = await this.current_project.get_meta();
    this.project_tr_files_tree.clear();
    this.project_tr_files_tree.set_paths(await this.current_project.list_tr_file_paths());
    this.project_game_files_tree.clear();
    this.project_game_files_tree.set_paths(await this.current_project.list_game_file_paths());

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
  public opened_tabs: BaseTab[] = [this.queue, this.search];
  public event_tab_opened = new Event2<[tab: BaseTab, index: number]>();
  public event_tab_closed = new Event2<[tab: BaseTab, index: number]>();

  public current_tab_index = 0;
  public current_tab: BaseTab | null = this.opened_tabs[this.current_tab_index];
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
        tab.notify_fragment_list_update(list);
      })();
    }
  }

  public clamp_tab_index(index: number): number {
    return Math.max(0, utils.clamp(Math.floor(index), 0, this.opened_tabs.length - 1));
  }

  public open_file(ft: FileType, path: string, trigger: TabChangeTrigger | null = null): void {
    let index = this.opened_tabs.findIndex(
      (tab) => tab instanceof TabFile && tab.file_type === ft && tab.file_path === path,
    );
    if (index < 0) {
      let tab = new TabFile(this, ft, path);
      index = this.opened_tabs.length;
      this.opened_tabs.push(tab);
      this.event_tab_opened.fire(tab, index);
    }
    this.set_current_tab_index(index, trigger);
  }

  public close_tab(index: number, trigger: TabChangeTrigger | null = null): void {
    let tab = this.opened_tabs[index];
    utils.assert(tab != null);
    if (!tab.is_closeable) return;
    this.opened_tabs.splice(index, 1);
    this.event_tab_closed.fire(tab, index);
    this.set_current_tab_index(
      this.current_tab_index - (this.current_tab_index > index ? 1 : 0),
      trigger,
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

  // Fragments received from the game window are queued and processed
  // asynchronously to not block the UI thread of the other window, especially
  // when re-rendering the UI in this one, and also because I'm not sure how
  // safe is calling a function from a different JS context.
  public received_fragments_queue: FragmentFromGame[] = [];
  // This function will be invoked from the game window by the connector mod.
  public receive_fragments_from_game(fragments: FragmentFromGame[]): void {
    let should_start_receiver = this.received_fragments_queue.length === 0;
    for (let i = 0, len = fragments.length; i < len; i++) {
      this.received_fragments_queue.push(fragments[i]);
    }
    if (should_start_receiver) {
      // A timer is used to avoid creating a microtask.
      setTimeout(async () => {
        try {
          while (this.received_fragments_queue.length > 0) {
            await this.queue.push_fragment_from_game(this.received_fragments_queue.shift()!);
          }
        } finally {
          this.received_fragments_queue.length = 0;
        }
      }, 0);
    }
  }
}

export abstract class BaseAppObject<T extends object> {
  public readonly obj_id: number = utils.new_gui_id();

  public changetick = 0;
  protected render_data_changetick = -1;
  protected render_data_cached: T | undefined;

  public mark_updated(): void {
    this.changetick += 1;
  }

  public is_render_data_dirty(): boolean {
    return this.render_data_changetick !== this.changetick;
  }

  public get_render_data(): T {
    if (this.render_data_changetick !== this.changetick) {
      this.render_data_cached = this.update_render_data_impl();
      this.render_data_changetick = this.changetick;
    }
    return this.render_data_cached!;
  }

  protected abstract update_render_data_impl(): T;
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export abstract class BaseRenderData {}

export enum TabChangeTrigger {
  FileTree,
  TabList,
}

export class BaseTabRoData extends BaseRenderData {
  public constructor(public readonly ref: BaseTab) {
    super();
  }
  public readonly is_closeable: boolean = this.ref.is_closeable;
}

export abstract class BaseTab extends BaseAppObject<BaseTabRoData> {
  public readonly loaded_promise: Promise<void> | null = null;
  public current_fragment_index = 0;
  public readonly is_closeable: boolean = true;

  public constructor(public readonly app: AppMain) {
    super();
  }

  protected override update_render_data_impl(): BaseTabRoData {
    return new BaseTabRoData(this);
  }

  // TODO: check that the returned list has exactly the requested size
  public abstract list_fragments(start?: number | null, end?: number | null): Promise<Fragment[]>;

  public notify_fragment_list_update(new_list: Fragment[]): void {
    if (this.app.current_tab_index === this.app.opened_tabs.indexOf(this)) {
      this.app.current_fragment_list = new_list;
      this.app.event_fragment_list_update.fire();
    }
  }
}

export interface FragmentFromGame {
  file_path: string;
  json_path: string;
}

export class TabQueueRoData extends BaseTabRoData {
  public constructor(public override readonly ref: TabQueue) {
    super(ref);
  }
}

export class TabQueue extends BaseTab {
  // TODO: This should be configurable in the UI.
  public static readonly MAX_SIZE: number = 200;

  public override readonly is_closeable = false;

  public override update_render_data_impl(): TabQueueRoData {
    return new TabQueueRoData(this);
  }

  public override get_render_data(): TabQueueRoData {
    return super.get_render_data() as TabQueueRoData;
  }

  public fragments: Fragment[] = [];
  public fragments_rev: Fragment[] = [];

  public async push_fragment_from_game({ file_path, json_path }: FragmentFromGame): Promise<void> {
    let fragments = await this.app.current_project!.query_fragments({
      from_game_file: file_path,
      json_paths: [json_path],
    });
    this.push_fragments(fragments.filter((f): f is Fragment => f != null));
  }

  public push_fragments(list: Fragment[]): void {
    let dedup_filter: (f: Fragment) => boolean = (_) => true;
    if (list.length === 1) {
      // The fast path:
      let f1 = list[0];
      dedup_filter = (f2) => f2.id !== f1.id;
    } else if (list.length > 1) {
      let ids = new Set<string>();
      for (let f1 of list) ids.add(f1.id);
      dedup_filter = (f2) => !ids.has(f2.id);
    }
    this.fragments = this.fragments.filter(dedup_filter).concat(list).slice(-TabQueue.MAX_SIZE);
    this.fragments_rev = this.fragments.slice().reverse();
    this.notify_fragment_list_update(this.fragments_rev.slice());
  }

  public list_fragments(start?: number | null, end?: number | null): Promise<Fragment[]> {
    return Promise.resolve(this.fragments_rev.slice(start ?? 0, end ?? this.fragments_rev.length));
  }
}

export class TabSearchRoData extends BaseTabRoData {
  public constructor(public override readonly ref: TabSearch) {
    super(ref);
  }
}

export class TabSearch extends BaseTab {
  public override readonly is_closeable = false;

  public override update_render_data_impl(): TabSearchRoData {
    return new TabSearchRoData(this);
  }

  public override get_render_data(): TabSearchRoData {
    return super.get_render_data() as TabSearchRoData;
  }

  public list_fragments(_start?: number | null, _end?: number | null): Promise<Fragment[]> {
    return Promise.resolve([]);
  }
}

export enum FileType {
  TrFile,
  GameFile,
}

export class TabFileRoData extends BaseTabRoData {
  public constructor(public override readonly ref: TabFile) {
    super(ref);
  }
  public readonly file_type = this.ref.file_type;
  public readonly file_path = this.ref.file_path;
}

export class TabFile extends BaseTab {
  public constructor(
    app: AppMain,
    public readonly file_type: FileType,
    public readonly file_path: string,
  ) {
    super(app);
  }

  public override update_render_data_impl(): TabFileRoData {
    return new TabFileRoData(this);
  }

  public override get_render_data(): TabFileRoData {
    return super.get_render_data() as TabFileRoData;
  }

  public get_file_name(): string {
    let idx = this.file_path.lastIndexOf('/');
    if (idx < 0) {
      return this.file_path;
    } else {
      return this.file_path.slice(idx + 1);
    }
  }

  public async list_fragments(start?: number | null, end?: number | null): Promise<Fragment[]> {
    return (await this.app.current_project!.query_fragments({
      from_game_file: this.file_type === FileType.GameFile ? this.file_path : null,
      from_tr_file: this.file_type === FileType.TrFile ? this.file_path : null,
      slice_start: start,
      slice_end: end,
    })) as Fragment[];
  }
}

export class FileTree extends BaseAppObject<FileTree> {
  public static readonly ROOT_DIR = '';

  public readonly files = new Map<string, FileTreeFile>();

  public constructor() {
    super();
    this.clear();
  }

  protected override update_render_data_impl(): FileTree {
    let tree = new FileTree();
    for (let [path, file] of this.files) {
      tree.files.set(path, file);
    }
    return tree;
  }

  public get root_dir(): FileTreeDir {
    let root_dir = this.files.get(FileTree.ROOT_DIR);
    utils.assert(root_dir instanceof FileTreeDir);
    return root_dir;
  }

  public get_file(path: string): FileTreeFile | undefined {
    return this.files.get(path);
  }

  public clear(): void {
    this.mark_updated();
    this.files.clear();
    let root_dir = new FileTreeDir(FileTree.ROOT_DIR);
    this.files.set(root_dir.path, root_dir);
  }

  public set_paths(paths: Iterable<string>): void {
    this.mark_updated();
    this.clear();

    for (let path of paths) {
      if (path === FileTree.ROOT_DIR) continue;
      let parent_dir = this.root_dir;

      for (let component of utils.split_iter(path, '/')) {
        let component_path = path.slice(0, component.end);
        // Unlock the children set - only this function is allowed to change
        // the structure.
        (parent_dir.children as Set<string>).add(component_path);
        if (component.is_last) {
          let file = new FileTreeFile(component_path);
          this.files.set(component_path, file);
        } else {
          let maybe_dir = this.files.get(component_path);
          if (!(maybe_dir instanceof FileTreeDir)) {
            let dir = new FileTreeDir(component_path);
            this.files.set(dir.path, dir);
            parent_dir = dir;
          } else {
            parent_dir = maybe_dir;
          }
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
  public readonly children: ReadonlySet<string> = new Set<string>();
}

export class Project {
  public static async open(backend: backend.Backend, dir: string): Promise<Project> {
    let res = await backend.send_request('open_project', { dir });
    return new Project(backend, dir, res.project_id);
  }

  public constructor(public backend: backend.Backend, public dir: string, public id: number) {}

  public async get_meta(): Promise<ProjectMeta> {
    let res = await this.backend.send_request('get_project_meta', {
      project_id: this.id,
    });
    return new ProjectMeta(
      this,
      res.root_dir,
      res.id,
      new Date(res.creation_timestamp * 1000),
      new Date(res.modification_timestamp * 1000),
      res.game_version,
      res.original_locale,
      res.reference_locales,
      res.translation_locale,
      res.translations_dir,
      res.splitter,
    );
  }

  public async list_tr_file_paths(): Promise<string[]> {
    let res = await this.backend.send_request('list_files', {
      project_id: this.id,
      file_type: 'tr_file',
    });
    return res.paths;
  }

  public async list_game_file_paths(): Promise<string[]> {
    let res = await this.backend.send_request('list_files', {
      project_id: this.id,
      file_type: 'game_file',
    });
    return res.paths;
  }

  public _create_fragment(f_raw: backend.ListedFragmentFields): Fragment {
    let f = new Fragment(
      this,
      f_raw.id,
      f_raw.tr_file_path,
      f_raw.game_file_path,
      f_raw.json_path,
      f_raw.lang_uid,
      f_raw.description,
      f_raw.original_text,
      new Set(f_raw.flags),
      [],
      [],
    );
    f.translations = f_raw.translations.map((tr_raw) => {
      return new Translation(
        f,
        tr_raw.id,
        tr_raw.author_username,
        tr_raw.editor_username,
        new Date(tr_raw.creation_timestamp * 1000),
        new Date(tr_raw.modification_timestamp * 1000),
        tr_raw.text,
        new Set(tr_raw.flags),
      );
    });
    f.comments = f_raw.comments.map((tr_raw) => {
      return new Comment(
        f,
        tr_raw.id,
        tr_raw.author_username,
        tr_raw.editor_username,
        new Date(tr_raw.creation_timestamp * 1000),
        new Date(tr_raw.modification_timestamp * 1000),
        tr_raw.text,
      );
    });
    return f;
  }

  public async query_fragments(query: {
    from_tr_file?: string | null;
    from_game_file?: string | null;
    slice_start?: number | null;
    slice_end?: number | null;
    json_paths?: string[] | null;
  }): Promise<Array<Fragment | null>> {
    let select_fields = {
      fragments: backend.ListedFragmentFields.ALL.slice(),
      translations: backend.ListedTranslationFields.ALL.slice(),
      comments: backend.ListedCommentFields.ALL.slice(),
    };
    let req_params: backend.MessageRegistry['query_fragments']['request'] = {
      project_id: this.id,
      select_fields,
      slice_start: query.slice_start,
      slice_end: query.slice_end,
    };

    if (query.from_tr_file != null) {
      req_params.from_tr_file = query.from_tr_file;
      utils.array_remove(select_fields.fragments, 'tr_file_path');
    }
    if (query.from_game_file != null) {
      req_params.from_game_file = query.from_game_file;
      utils.array_remove(select_fields.fragments, 'game_file_path');
    }
    if (query.json_paths != null) {
      req_params.json_paths = query.json_paths;
      utils.array_remove(select_fields.fragments, 'json_path');
    }

    let res = await this.backend.send_request('query_fragments', req_params);
    return backend.expand_table_data('fragments', res.fragments, select_fields).map((frag, idx) => {
      if (frag == null) return null;

      if (query.from_tr_file != null) {
        frag.tr_file_path = query.from_tr_file;
      }
      if (query.from_game_file != null) {
        frag.game_file_path = query.from_game_file;
      }
      if (query.json_paths != null) {
        frag.json_path = query.json_paths[idx];
      }

      return this._create_fragment(frag);
    });
  }
}

export class ProjectMetaRoData extends BaseRenderData {
  public constructor(public readonly ref: ProjectMeta) {
    super();
  }
  public readonly root_dir: string = this.ref.root_dir;
  public readonly id: string = this.ref.id;
  public readonly creation_timestamp: Date = this.ref.creation_timestamp;
  public readonly modification_timestamp: Date = this.ref.modification_timestamp;
  public readonly game_version: string = this.ref.game_version;
  public readonly original_locale: string = this.ref.original_locale;
  public readonly reference_locales: string[] = this.ref.reference_locales.slice();
  public readonly translation_locale: string = this.ref.translation_locale;
  public readonly translations_dir: string = this.ref.translations_dir;
  public readonly splitter: string = this.ref.splitter;
}

export class ProjectMeta extends BaseAppObject<ProjectMetaRoData> {
  public constructor(
    public readonly project: Project,
    public root_dir: string,
    public id: string,
    public creation_timestamp: Date,
    public modification_timestamp: Date,
    public game_version: string,
    public original_locale: string,
    public reference_locales: string[],
    public translation_locale: string,
    public translations_dir: string,
    public splitter: string,
  ) {
    super();
  }

  public update_render_data_impl(): ProjectMetaRoData {
    return new ProjectMetaRoData(this);
  }
}

export class FragmentRoData extends BaseRenderData {
  public constructor(public readonly ref: Fragment) {
    super();
  }
  public readonly id: string = this.ref.id;
  public readonly tr_file_path: string = this.ref.tr_file_path;
  public readonly game_file_path: string = this.ref.game_file_path;
  public readonly json_path: string = this.ref.json_path;
  public readonly lang_uid: number = this.ref.lang_uid;
  public readonly description: string[] = this.ref.description.slice();
  public readonly original_text: string = this.ref.original_text;
  public readonly flags: ReadonlySet<string> = new Set(this.ref.flags);
  public readonly translations: TranslationRoData[] = this.ref.translations.map((tr) =>
    tr.get_render_data(),
  );
  public readonly comments: CommentRoData[] = this.ref.comments.map((cm) => cm.get_render_data());
}

export class Fragment extends BaseAppObject<FragmentRoData> {
  public constructor(
    public readonly project: Project,
    public id: string,
    public tr_file_path: string,
    public game_file_path: string,
    public json_path: string,
    public lang_uid: number,
    public description: string[],
    public original_text: string,
    public flags: Set<string>,
    public translations: Translation[],
    public comments: Comment[],
  ) {
    super();
  }

  protected override update_render_data_impl(): FragmentRoData {
    return new FragmentRoData(this);
  }

  public has_lang_uid(): boolean {
    return this.lang_uid !== 0;
  }
}

export class TranslationRoData extends BaseRenderData {
  public constructor(public readonly ref: Translation) {
    super();
  }
  public readonly id: string = this.ref.id;
  public readonly author_username: string = this.ref.author_username;
  public readonly editor_username: string = this.ref.editor_username;
  public readonly creation_timestamp: Date = new Date(this.ref.creation_timestamp);
  public readonly modification_timestamp: Date = new Date(this.ref.modification_timestamp);
  public readonly text: string = this.ref.text;
  public readonly flags: ReadonlySet<string> = new Set(this.ref.flags);
}

export class Translation extends BaseAppObject<TranslationRoData> {
  public constructor(
    public fragment: Fragment,
    public id: string,
    public author_username: string,
    public editor_username: string,
    public creation_timestamp: Date,
    public modification_timestamp: Date,
    public text: string,
    public flags: Set<string>,
  ) {
    super();
  }

  protected override update_render_data_impl(): TranslationRoData {
    return new TranslationRoData(this);
  }
}

export class CommentRoData extends BaseRenderData {
  public constructor(public readonly ref: Comment) {
    super();
  }
  public readonly id: string = this.ref.id;
  public readonly author_username: string = this.ref.author_username;
  public readonly editor_username: string = this.ref.editor_username;
  public readonly creation_timestamp: Date = new Date(this.ref.creation_timestamp);
  public readonly modification_timestamp: Date = new Date(this.ref.modification_timestamp);
  public readonly text: string = this.ref.text;
}

export class Comment extends BaseAppObject<CommentRoData> {
  public constructor(
    public fragment: Fragment,
    public id: string,
    public author_username: string,
    public editor_username: string,
    public creation_timestamp: Date,
    public modification_timestamp: Date,
    public text: string,
  ) {
    super();
  }

  protected override update_render_data_impl(): CommentRoData {
    return new CommentRoData(this);
  }
}
