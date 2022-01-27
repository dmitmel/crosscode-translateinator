import './Explorer.scss';
import './Button';

import cc from 'clsx';
import * as Inferno from 'inferno';
import * as React from 'react';
import * as ReactWindow from 'react-window';

import { FileTree, FileTreeDir, FileTreeFile, FileType, TabChangeTrigger, TabFile } from '../app';
import { AppMainGuiCtx } from './AppMain';
import { BoxGui, WrapperGui } from './Box';
import { IconGui } from './Icon';
import { LabelGui } from './Label';

export class ExplorerGui extends Inferno.Component<unknown, unknown> {
  public override context!: AppMainGuiCtx;

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
    this.forceUpdate();
  };

  private on_project_closed = (): void => {
    this.forceUpdate();
  };

  public override render(): JSX.Element {
    let { app } = this.context;
    return (
      <BoxGui orientation="vertical" className="Explorer">
        <div className="Explorer-Header">
          <IconGui icon={null} /> PROJECT [
          {app.current_project_meta?.translation_locale ?? 'loading...'}]
        </div>

        <ExplorerSectionGui name="Translation files">
          <TreeViewGui
            tree={app.project_tr_files_tree}
            files_type={FileType.TrFile}
            base_depth={1}
          />
        </ExplorerSectionGui>

        <ExplorerSectionGui name="Game files" default_opened>
          <TreeViewGui
            tree={app.project_game_files_tree}
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

export class ExplorerSectionGui extends Inferno.Component<
  ExplorerSectionGuiProps,
  ExplorerSectionGuiState
> {
  public override state: ExplorerSectionGuiState = {
    is_opened: this.props.default_opened ?? false,
  };

  private on_name_click = (): void => {
    this.setState({ is_opened: !this.state.is_opened });
  };

  public override render(): JSX.Element {
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
  tree: FileTree;
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
}

class TreeViewGui extends Inferno.Component<TreeViewGuiProps, TreeViewGuiState> {
  public override context!: AppMainGuiCtx;
  public override state: TreeViewGuiState = {
    list_height: -1,
  };

  public list_ref = Inferno.createRef<ReactWindow.FixedSizeList<PreparedTreeItem[]>>();
  public item_indexes_map = new Map<string, number>();

  public opened_states = new Map<string, boolean>();
  private next_opened_states = new Map<string, boolean>();
  public is_opened(path: string): boolean {
    return this.opened_states.get(path) ?? false;
  }

  public current_path: string | null = null;
  public set_current(path: string | null): void {
    if (this.current_path != null) {
      this.opened_states.set(this.current_path, false);
    }

    this.current_path = path;
    if (path != null) {
      let component_start_index = 0;
      while (component_start_index < path.length) {
        let separator_index = path.indexOf('/', component_start_index);
        let is_last_component = separator_index < 0;
        let component_end_index = is_last_component ? path.length : separator_index;
        let component_path = path.slice(0, component_end_index);
        this.opened_states.set(component_path, true);
        component_start_index = component_end_index + 1;
      }
    }

    this.forceUpdate();
  }

  private resize_observer: ResizeObserver | null = null;
  private resize_observer_target = Inferno.createRef<HTMLDivElement>();

  public override componentDidMount(): void {
    this.resize_observer = new ResizeObserver(this.resize_observer_callback);
    this.resize_observer.observe(this.resize_observer_target.current!, { box: 'border-box' });

    let { app } = this.context;
    app.event_current_tab_change.on(this.on_current_tab_change);
    this.on_current_tab_change(null);
  }

  public override componentWillUnmount(): void {
    this.resize_observer!.disconnect();
    this.resize_observer = null;

    let { app } = this.context;
    app.event_current_tab_change.off(this.on_current_tab_change);
  }

  private on_current_tab_change = (trigger: TabChangeTrigger | null): void => {
    let { app } = this.context;
    let tab = app.current_tab;
    if (tab instanceof TabFile && tab.file_type === this.props.files_type) {
      this.set_current(tab.file_path);
      if (trigger !== TabChangeTrigger.FileTree) {
        this.scroll_to_file(tab.file_path);
      }
    } else {
      this.set_current(null);
    }
  };

  public scroll_to_file(path: string): void {
    let index = this.item_indexes_map.get(path);
    if (index != null) {
      this.list_ref.current?.scrollToItem(index, 'smart');
    }
  }

  private on_item_click = (
    file: FileTreeFile,
    _event: Inferno.InfernoMouseEvent<HTMLButtonElement>,
  ): void => {
    let { app } = this.context;
    if (file instanceof FileTreeDir) {
      this.opened_states.set(file.path, !this.is_opened(file.path));
      this.forceUpdate();
    } else {
      app.open_file(this.props.files_type, file.path, TabChangeTrigger.FileTree);
    }
  };

  private resize_observer_callback = (entries: ResizeObserverEntry[]): void => {
    for (let entry of entries) {
      if (entry.target === this.resize_observer_target.current) {
        let list_height = entry.contentRect.height;
        this.setState((prev_state) =>
          prev_state.list_height !== list_height ? { list_height } : null,
        );
      }
    }
  };

  public override render(): JSX.Element {
    return (
      <WrapperGui inner_ref={this.resize_observer_target} expand>
        {this.state.list_height >= 0 ? this.render_list() : null}
      </WrapperGui>
    );
  }

  private render_list(): JSX.Element {
    this.next_opened_states.clear();
    this.item_indexes_map.clear();

    let items: PreparedTreeItem[] = [];
    this.prepare_items(this.props.tree.root_dir, this.props.base_depth ?? 0, items);

    let prev_opened_states = this.opened_states;
    this.opened_states = this.next_opened_states;
    prev_opened_states.clear();
    this.next_opened_states = prev_opened_states;

    return (
      <ReactWindow.FixedSizeList
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={this.list_ref as any}
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
  // make React/Inferno think that a completely different component is used for
  // list items every time, causing the whole list to be re-rendered even if no
  // items actually change.
  private render_list_item: React.ComponentType<
    ReactWindow.ListChildComponentProps<PreparedTreeItem[]>
  > = ({ index, style, data }) => {
    let item = data[index];
    return (
      <TreeItemGui
        style={style as CSSProperties}
        file_type={this.props.files_type}
        file={item.file}
        is_opened={item.is_opened}
        depth={item.depth}
        index={index}
        on_click={Inferno.linkEvent(item.file, this.on_item_click)}
      />
    ) as React.ReactElement;
  };

  private prepare_items(dir: FileTreeDir, depth: number, out_items: PreparedTreeItem[]): void {
    let files: FileTreeFile[] = [];

    // TODO: sorting

    for (let path of dir.children) {
      let file: FileTreeFile | undefined = this.props.tree.get_file(path);
      if (file instanceof FileTreeDir) {
        out_items.push(this.prepare_item(file, depth, out_items.length));
        if (this.is_opened(file.path)) {
          this.prepare_items(file, depth + 1, out_items);
        }
      } else if (file != null) {
        files.push(file);
      } else {
        throw new Error(`Unknown file: ${path}`);
      }
    }

    for (let file of files) {
      out_items.push(this.prepare_item(file, depth, out_items.length));
    }
  }

  private prepare_item(file: FileTreeFile, depth: number, index: number): PreparedTreeItem {
    let is_opened = this.is_opened(file.path);
    this.next_opened_states.set(file.path, is_opened);
    this.item_indexes_map.set(file.path, index);
    return { file, is_opened, depth };
  }
}

export interface TreeItemGuiProps {
  file_type: FileType;
  file: FileTreeFile;
  is_opened: boolean;
  depth: number;
  index: number;
  on_click: Inferno.MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
}

export function TreeItemGui(props: TreeItemGuiProps): JSX.Element {
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
