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
import { BoxGui } from './Box';
import { IconGui } from './Icon';
import { LabelGui } from './Label';
import { VirtListItemFnProps, VirtListScrollAlign, VirtualizedListGui } from './VirtualizedList';

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
      <BoxGui orientation="vertical" className={cc(this.props.className, 'Explorer')}>
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
      </BoxGui>
    );
  }
}

export interface ExplorerSectionGuiProps {
  name: string;
  default_opened?: boolean;
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
      <BoxGui
        orientation="vertical"
        className={cc('ExplorerSection', {
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
      </BoxGui>
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

  public list_ref = React.createRef<VirtualizedListGui<TreeVirtListData>>();
  public item_indexes_map = new Map<string, number>();

  public override componentDidMount(): void {
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

  private on_current_tab_change = (_trigger: TabChangeTrigger | null): void => {
    let { app } = this.context;
    let tab = app.current_tab;
    let file_path: string | null = null;
    if (tab instanceof TabFile && tab.file_type === this.props.files_type) {
      file_path = tab.file_path;
    }
    this.set_current(file_path, () => {
      if (file_path != null) {
        this.scroll_to_file(file_path);
      }
    });
  };

  private on_file_tree_updated = (): void => {
    this.setState({ tree_data: this.props.tree_ref.get_render_data() });
  };

  public scroll_to_file(path: string): void {
    let index = this.item_indexes_map.get(path);
    if (index != null) {
      this.list_ref.current!.scroll_to_item(index, VirtListScrollAlign.Smart);
    }
  }

  private on_item_click = (
    file: FileTreeFile,
    _event: React.MouseEvent<HTMLButtonElement>,
  ): void => {
    let { app } = this.context;
    let file_path = file.path;
    if (file instanceof FileTreeDir) {
      this.setState(({ opened_states }) => ({
        opened_states: opened_states.set(file_path, !opened_states.get(file_path)),
      }));
    } else {
      app.open_file(this.props.files_type, file_path, TabChangeTrigger.FileTree);
    }
  };

  public override render(): React.ReactNode {
    let items: PreparedTreeItem[] = [];
    this.item_indexes_map.clear();
    this.prepare_items(this.state.tree_data.root_dir, this.props.base_depth ?? 0, items);

    return (
      <VirtualizedListGui
        ref={this.list_ref}
        className={cc(this.props.className, 'TreeView')}
        item_count={items.length}
        item_data={items}
        render_item={this.render_list_item}
        item_size={30}
        fixed_size_items
      />
    );
  }

  private render_list_item = (props: VirtListItemFnProps<TreeVirtListData>): React.ReactNode => {
    let item = props.data[props.index];
    return (
      <TreeItemGui
        key={item.file.path}
        list={props.list}
        file_type={this.props.files_type}
        file={item.file}
        is_opened={item.is_opened}
        depth={item.depth}
        index={props.index}
        on_click={this.on_item_click}
      />
    );
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
    this.item_indexes_map.set(file.path, index);
    return { file, is_opened: this.state.opened_states.get(file.path) ?? false, depth };
  }
}

export interface TreeItemGuiProps {
  file_type: FileType;
  file: FileTreeFile;
  is_opened: boolean;
  depth: number;
  index: number;
  on_click: (file: FileTreeFile, event: React.MouseEvent<HTMLButtonElement>) => void;
  list?: VirtualizedListGui<TreeVirtListData>;
}

export class TreeItemGui extends React.Component<TreeItemGuiProps, unknown> {
  public root_ref = React.createRef<HTMLButtonElement>();

  public override componentDidMount(): void {
    this.props.list?.on_item_mounted(this.props.index, this.root_ref.current!);
  }

  public override componentDidUpdate(prev_props: TreeItemGuiProps): void {
    this.props.list?.on_item_updated(prev_props.index, this.props.index, this.root_ref.current!);
  }

  public override componentWillUnmount(): void {
    this.props.list?.on_item_unmounted(this.props.index, this.root_ref.current!);
  }

  private on_click = (event: React.MouseEvent<HTMLButtonElement>): void => {
    this.props.on_click(this.props.file, event);
  };

  public override render(): React.ReactNode {
    let { props } = this;
    let is_directory = props.file instanceof FileTreeDir;

    let gui_data = GameFileGuiData.get(props.file_type, props.file.path);
    let label = props.file.path;
    let { icon } = gui_data;
    if (is_directory) {
      label += '/';
      icon = `chevron-${props.is_opened ? 'down' : 'right'}`;
    }

    return (
      <button
        ref={this.root_ref}
        type="button"
        className={cc('block', 'TreeItem', {
          'TreeItem-current': !is_directory && props.is_opened,
        })}
        style={{ '--TreeItem-depth': props.depth } as React.CSSProperties}
        title={label}
        tabIndex={0}
        onClick={this.on_click}>
        {
          // Note that a container element is necessary for enabling ellipsis,
          // otherwise the tree item shrinks when the enclosing list begins
          // overflowing.
        }
        <LabelGui block ellipsis>
          <IconGui icon={icon} /> {props.file.name}
        </LabelGui>
      </button>
    );
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
