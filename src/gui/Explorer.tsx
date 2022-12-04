import './Explorer.scss';
import './Button';

import cc from 'clsx';
import Immutable from 'immutable';
import * as React from 'react';

import {
  FileTree,
  FileTreeDir,
  FileTreeFile,
  FileType,
  ProjectMetaRoData,
  TabChangeTrigger,
  TabFile,
} from '../app';
import * as utils from '../utils';
import { AppMainCtx } from './AppMainCtx';
import { VBoxGui } from './Box';
import { IconGui } from './Icon';
import { KeyCode, KeymapActionsLayer } from './keymap';
import { ListBoxGetIndexKind, ListBoxGui, ListBoxItem } from './ListBox';
import { VirtListScrollAlign } from './VirtualizedList';

export interface ExplorerGuiProps {
  className?: string;
}

export interface ExplorerGuiState {
  project_meta: ProjectMetaRoData | null;
}

export class ExplorerGui extends React.Component<ExplorerGuiProps, ExplorerGuiState> {
  public static override contextType = AppMainCtx;
  public override context!: AppMainCtx;
  public override state: Readonly<ExplorerGuiState> = {
    project_meta: this.copy_project_meta(),
  };

  private copy_project_meta(): ProjectMetaRoData | null {
    let { app } = this.context;
    return app.current_project_meta?.get_render_data() ?? null;
  }

  public override componentDidMount(): void {
    let { app } = this.context;
    app.event_project_opened.on(this.on_project_opened);
    app.event_project_closed.on(this.on_project_closed);
  }

  public override componentWillUnmount(): void {
    let { app } = this.context;
    app.event_project_opened.off(this.on_project_opened);
    app.event_project_closed.off(this.on_project_closed);
  }

  private on_project_opened = (): void => {
    this.setState({ project_meta: this.copy_project_meta() });
  };

  private on_project_closed = (): void => {
    this.setState({ project_meta: this.copy_project_meta() });
  };

  public override render(): React.ReactNode {
    let { app } = this.context;
    return (
      <VBoxGui className={cc(this.props.className, 'Explorer')}>
        <div className="Explorer-Header">
          <IconGui icon={null} /> PROJECT [
          {this.state.project_meta?.translation_locale ?? 'loading...'}]
        </div>

        <ExplorerSectionGui name="Translation files">
          <TreeViewGui
            tree_ref={app.project_tr_files_tree}
            files_type={FileType.TrFile}
            base_depth={1}
          />
        </ExplorerSectionGui>

        <ExplorerSectionGui name="Game files" default_opened>
          <TreeViewGui
            tree_ref={app.project_game_files_tree}
            files_type={FileType.GameFile}
            base_depth={1}
          />
        </ExplorerSectionGui>
      </VBoxGui>
    );
  }
}

export interface ExplorerSectionGuiProps {
  className?: string;
  name: string;
  default_opened?: boolean;
  children: React.ReactNode;
}

export interface ExplorerSectionGuiState {
  is_opened: boolean;
}

export class ExplorerSectionGui extends React.Component<
  ExplorerSectionGuiProps,
  ExplorerSectionGuiState
> {
  public override state: Readonly<ExplorerSectionGuiState> = {
    is_opened: this.props.default_opened ?? false,
  };

  private on_name_click = (): void => {
    this.setState((state) => ({ is_opened: !state.is_opened }));
  };

  public override render(): React.ReactNode {
    let { is_opened } = this.state;
    return (
      <VBoxGui
        className={cc(this.props.className, 'ExplorerSection', {
          'ExplorerSection-opened': is_opened,
          'BoxItem-expand': is_opened,
        })}>
        <div>
          <button
            type="button"
            className="block ExplorerSection-Name TreeItem"
            tabIndex={0}
            onClick={this.on_name_click}>
            <IconGui icon={`chevron-${is_opened ? 'down' : 'right'}`} /> {this.props.name}
          </button>
        </div>
        {is_opened ? this.props.children : null}
      </VBoxGui>
    );
  }
}

export interface TreeViewGuiProps {
  className?: string;
  tree_ref: FileTree;
  files_type: FileType;
  base_depth?: number;
}

export interface PreparedTreeItem {
  file: FileTreeFile;
  is_opened: boolean;
  depth: number;
}

export interface TreeViewGuiState {
  list_height: number;
  current_path: string | null;
  tree_data: FileTree;
  opened_states: Immutable.Map<string, boolean>;
}

export type TreeVirtListData = readonly PreparedTreeItem[];

export class TreeViewGui extends React.Component<TreeViewGuiProps, TreeViewGuiState> {
  public static override contextType = AppMainCtx;
  public override context!: AppMainCtx;
  public override state: Readonly<TreeViewGuiState> = {
    list_height: -1,
    current_path: null,
    tree_data: this.props.tree_ref.get_render_data(),
    opened_states: Immutable.Map(),
  };

  public list_ref = React.createRef<ListBoxGui<TreeVirtListData>>();
  public list_extra_keymap_layer = new KeymapActionsLayer();
  public paths_to_indexes_map = new Map<string, number>();
  public indexes_to_files_map = new Map<number, FileTreeFile>();

  public override componentDidMount(): void {
    this.setup_keymap();
    let { app } = this.context;
    app.event_current_tab_change.on(this.on_current_tab_change);
    app.event_project_opened.on(this.on_file_tree_updated);
    app.event_project_closed.on(this.on_file_tree_updated);
  }

  public override componentWillUnmount(): void {
    let { app } = this.context;
    app.event_current_tab_change.off(this.on_current_tab_change);
    app.event_project_opened.off(this.on_file_tree_updated);
    app.event_project_closed.off(this.on_file_tree_updated);
  }

  public set_path_opened_state(
    path: string,
    updater: (prev_state: boolean | undefined) => boolean,
  ): void {
    this.setState(({ opened_states }) => ({ opened_states: opened_states.update(path, updater) }));
  }

  public set_current(path: string | null, callback?: () => void): void {
    this.setState(({ opened_states, current_path }) => {
      opened_states = opened_states.withMutations((opened_states) => {
        if (current_path != null) {
          opened_states.set(current_path, false);
        }
        current_path = path;
        if (path != null) {
          for (let component of utils.split_iter(path, '/')) {
            let component_path = path.slice(0, component.end);
            opened_states.set(component_path, true);
          }
        }
      });
      return { opened_states, current_path };
    }, callback);
  }

  private on_current_tab_change = (trigger: TabChangeTrigger | null): void => {
    if (trigger === TabChangeTrigger.FileTree) return;
    let { app } = this.context;
    let tab = app.current_tab;
    let file_path: string | null = null;
    if (tab instanceof TabFile && tab.file_type === this.props.files_type) {
      file_path = tab.file_path;
    }
    this.set_current(file_path, () => {
      if (file_path != null) {
        let index = this.paths_to_indexes_map.get(file_path) ?? null;
        this.list_ref.current!.set_focus(index, {
          set_selection: true,
          set_dom_focus: false,
          scroll_to_align: VirtListScrollAlign.Smart,
        });
      }
    });
  };

  private on_file_tree_updated = (): void => {
    this.setState({ tree_data: this.props.tree_ref.get_render_data() });
  };

  private on_item_activated = (indices: number[], items: TreeVirtListData): void => {
    for (let index of indices) {
      let { file } = items[index];
      let { app } = this.context;
      if (file.is_dir()) {
        this.set_path_opened_state(file.path, (opened) => !opened);
      } else {
        app.open_file(this.props.files_type, file.path, TabChangeTrigger.FileTree);
      }
    }
  };

  private setup_keymap(): void {
    const get_focused_file = (): FileTreeFile | undefined => {
      let current_index = this.list_ref.current!.get_focused_index();
      return current_index != null ? this.indexes_to_files_map.get(current_index) : null!;
    };

    this.list_extra_keymap_layer.add(KeyCode.ArrowLeft, () => {
      let current_file = get_focused_file();
      if (current_file == null) return;
      if (current_file.is_dir() && this.state.opened_states.get(current_file.path)) {
        this.set_path_opened_state(current_file.path, () => false);
      } else if (current_file.parent != null && !current_file.parent.is_root_dir) {
        let index = this.paths_to_indexes_map.get(current_file.parent.path);
        this.list_ref.current!.set_focus(index);
      }
    });

    this.list_extra_keymap_layer.add(KeyCode.ArrowRight, () => {
      let current_file = get_focused_file();
      if (current_file?.is_dir() && !this.state.opened_states.get(current_file.path)) {
        this.set_path_opened_state(current_file.path, () => true);
      } else {
        let list = this.list_ref.current!;
        list.set_focus(list.get_index(ListBoxGetIndexKind.Next));
      }
    });
  }

  public override render(): React.ReactNode {
    let items: PreparedTreeItem[] = [];
    this.paths_to_indexes_map.clear();
    this.indexes_to_files_map.clear();
    this.prepare_items(this.state.tree_data.root_dir, this.props.base_depth ?? 0, items);

    return (
      <ListBoxGui
        ref={this.list_ref}
        className={cc(this.props.className, 'TreeView')}
        item_count={items.length}
        item_data={items}
        item_key={this.get_list_item_key}
        render_item={this.render_list_item}
        allow_multi_selection
        on_item_activated={this.on_item_activated}
        extra_keymap_layer={this.list_extra_keymap_layer}
      />
    );
  }

  private get_list_item_key = (index: number, items: TreeVirtListData): React.Key => {
    return items[index].file.obj_id;
  };

  private render_list_item = (index: number, items: TreeVirtListData): ListBoxItem => {
    let item = items[index];

    let gui_data = GameFileGuiData.get(this.props.files_type, item.file.path);
    let label = item.file.path;
    let { icon } = gui_data;
    if (item.file.is_dir()) {
      label += '/';
      icon = `chevron-${item.is_opened ? 'down' : 'right'}`;
    }

    return {
      className: 'TreeItem',
      style: { '--TreeItem-depth': item.depth } as React.CSSProperties,
      label: item.file.name,
      tooltip: label,
      icon,
    };
  };

  private prepare_items(dir: FileTreeDir, depth: number, out_items: PreparedTreeItem[]): void {
    let files: FileTreeFile[] = [];

    // TODO: sorting

    for (let path of dir.children) {
      let file: FileTreeFile | undefined = this.state.tree_data.get_file(path);
      if (file instanceof FileTreeDir) {
        out_items.push(this.prepare_item(file, depth, out_items.length));
        if (this.state.opened_states.get(file.path)) {
          this.prepare_items(file, depth + 1, out_items);
        }
      } else if (file != null) {
        files.push(file);
      } else {
        throw new Error(`Broken file tree structure, file not found: ${path}`);
      }
    }

    for (let file of files) {
      out_items.push(this.prepare_item(file, depth, out_items.length));
    }
  }

  private prepare_item(file: FileTreeFile, depth: number, index: number): PreparedTreeItem {
    this.paths_to_indexes_map.set(file.path, index);
    this.indexes_to_files_map.set(index, file);
    return { file, is_opened: this.state.opened_states.get(file.path) ?? false, depth };
  }
}

export abstract class FileTypeGuiData {
  public abstract icon: string;
  public abstract icon_filled: string;
  public abstract description: string;

  public constructor(public file_type: FileType, public file_path: string) {}

  public static get(...args: ConstructorParameters<typeof FileTypeGuiData>): FileTypeGuiData {
    let [file_type] = args;
    switch (file_type) {
      case FileType.TrFile:
        return new TrFileGuiData(...args);
      case FileType.GameFile:
        return new GameFileGuiData(...args);
      default:
        throw new Error(`unknown file type: ${file_type}`);
    }
  }
}

export class TrFileGuiData extends FileTypeGuiData {
  public icon = 'file-earmark-zip';
  public icon_filled = `${this.icon}-fill`;
  public description = `Translation file ${this.file_path}`;
}

export class GameFileGuiData extends FileTypeGuiData {
  public icon = 'file-earmark-text';
  public icon_filled = `${this.icon}-fill`;
  public description = `Game file ${this.file_path}`;
}
