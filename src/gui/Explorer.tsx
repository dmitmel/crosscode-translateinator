import './Explorer.scss';
import './Button';

import cc from 'clsx';
import Immutable from 'immutable';
import * as preact from 'preact';
import * as React from 'react';
import * as ReactWindow from 'react-window';

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
import { AppMainGuiCtx } from './AppMain';
import { BoxGui, WrapperGui } from './Box';
import { IconGui } from './Icon';
import { LabelGui } from './Label';

export interface ExplorerGuiProps {
  className?: string;
}

export interface ExplorerGuiState {
  readonly project_meta: ProjectMetaRoData | null;
}

export class ExplorerGui extends preact.Component<ExplorerGuiProps, ExplorerGuiState> {
  public override context!: AppMainGuiCtx;
  public override state: ExplorerGuiState = {
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

  public override render(): preact.VNode {
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
  readonly is_opened: boolean;
}

export class ExplorerSectionGui extends preact.Component<
  ExplorerSectionGuiProps,
  ExplorerSectionGuiState
> {
  public override state: ExplorerSectionGuiState = {
    is_opened: this.props.default_opened ?? false,
  };

  private on_name_click = (): void => {
    this.setState({ is_opened: !this.state.is_opened });
  };

  public override render(): preact.VNode {
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
  readonly list_height: number;
  readonly current_path: string | null;
  readonly tree_data: FileTree;
  readonly opened_states: Immutable.Map<string, boolean>;
}

export class TreeViewGui extends preact.Component<TreeViewGuiProps, TreeViewGuiState> {
  public override context!: AppMainGuiCtx;
  public override state: TreeViewGuiState = {
    list_height: -1,
    current_path: null,
    tree_data: this.props.tree_ref.get_render_data(),
    opened_states: Immutable.Map(),
  };

  public list_ref = preact.createRef<ReactWindow.FixedSizeList<PreparedTreeItem[]>>();
  public item_indexes_map = new Map<string, number>();

  private resize_observer: ResizeObserver | null = null;
  private resize_observer_target = preact.createRef<HTMLDivElement>();

  public override componentDidMount(): void {
    this.resize_observer = new ResizeObserver(this.resize_observer_callback);
    this.resize_observer.observe(this.resize_observer_target.current!, { box: 'border-box' });

    let { app } = this.context;
    app.event_current_tab_change.on(this.on_current_tab_change);
    app.event_project_opened.on(this.on_file_tree_updated);
    app.event_project_closed.on(this.on_file_tree_updated);
  }

  public override componentWillUnmount(): void {
    this.resize_observer!.disconnect();
    this.resize_observer = null;

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

  private on_current_tab_change = (trigger: TabChangeTrigger | null): void => {
    let { app } = this.context;
    let tab = app.current_tab;
    let file_path: string | null = null;
    if (tab instanceof TabFile && tab.file_type === this.props.files_type) {
      file_path = tab.file_path;
    }
    this.set_current(file_path, () => {
      if (trigger !== TabChangeTrigger.FileTree && file_path != null) {
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
      this.list_ref.current?.scrollToItem(index, 'smart');
    }
  }

  private on_item_click = (
    file: FileTreeFile,
    _event: preact.JSX.TargetedMouseEvent<HTMLButtonElement>,
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

  private resize_observer_callback = (entries: ResizeObserverEntry[]): void => {
    for (let entry of entries) {
      if (entry.target === this.resize_observer_target.current) {
        let list_height = entry.contentRect.height;
        this.setState((state) => (state.list_height !== list_height ? { list_height } : null));
      }
    }
  };

  public override render(): preact.VNode {
    return (
      <WrapperGui inner_ref={this.resize_observer_target} expand>
        {this.state.list_height >= 0 ? this.render_list() : null}
      </WrapperGui>
    );
  }

  private render_list(): preact.VNode {
    let items: PreparedTreeItem[] = [];
    this.item_indexes_map.clear();
    this.prepare_items(this.state.tree_data.root_dir, this.props.base_depth ?? 0, items);

    let FixedSizeList = ReactWindow.FixedSizeList as preact.ComponentClass<
      ReactWindow.FixedSizeListProps<PreparedTreeItem[]>
    >;
    return (
      <FixedSizeList
        ref={this.list_ref}
        width={'100%'}
        height={this.state.list_height}
        itemSize={30}
        itemData={items}
        itemCount={items.length}
        itemKey={(index, data) => data[index].file.path}
        children={this.render_list_item}
      />
    );
  }

  // This can't be an anonymous function because the virtual list library
  // passes it as the first argument to `React.createElement`, to handle both
  // class and functional components. However, this means that if the function
  // is defined anonymously in the JSX where the list component is used, on
  // every render a different instance of it will be created, and this would
  // make React think that a completely different component is used for list
  // items every time, causing the whole list to be re-rendered even if no
  // items actually change.
  private render_list_item: React.ComponentType<
    ReactWindow.ListChildComponentProps<PreparedTreeItem[]>
  > = ({ index, style, data }) => {
    let item = data[index];
    return (
      <TreeItemGui
        style={style as preact.JSX.CSSProperties}
        file_type={this.props.files_type}
        file={item.file}
        is_opened={item.is_opened}
        depth={item.depth}
        index={index}
        on_click={(event) => this.on_item_click(item.file, event)}
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
  on_click: preact.JSX.MouseEventHandler<HTMLButtonElement>;
  style?: preact.JSX.CSSProperties;
}

export function TreeItemGui(props: TreeItemGuiProps): preact.VNode {
  let is_directory = props.file instanceof FileTreeDir;

  let icon: string;
  let label = props.file.path;
  if (is_directory) {
    label += '/';
    icon = `chevron-${props.is_opened ? 'down' : 'right'}`;
  } else if (props.file_type === FileType.TrFile) {
    icon = 'file-earmark-zip';
  } else if (props.file_type === FileType.GameFile) {
    icon = 'file-earmark-text';
  } else {
    throw new Error('unreachable');
  }

  return (
    <button
      type="button"
      className={cc('block', 'TreeItem', {
        'TreeItem-current': !is_directory && props.is_opened,
      })}
      style={{ ...props.style, '--TreeItem-depth': props.depth }}
      title={label}
      tabIndex={0}
      onClick={props.on_click}>
      {
        // Note that a nested div for enabling ellipsis is necessary,
        // otherwise the tree item shrinks when the enclosing list begins
        // overflowing.
      }
      <LabelGui block ellipsis>
        <IconGui icon={icon} /> {props.file.name}
      </LabelGui>
    </button>
  );
}
