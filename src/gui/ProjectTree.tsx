import './ProjectTree.scss';
import './Button';

import cc from 'clsx';
import * as Inferno from 'inferno';

import { PathTree } from '../app';
import * as utils from '../utils';
import { AppMainGuiCtx } from './AppMain';
import { BoxGui, WrapperGui } from './Box';
import { IconGui } from './Icon';
import { LabelGui } from './Label';

export class ProjectTreeGui extends Inferno.Component<unknown, unknown> {
  public context!: AppMainGuiCtx;
  public prev_tr_file_path: string | null = null;
  public tr_file_tree_map = new Map<string, FileTreeItemGui>();
  public prev_game_file_path: string | null = null;
  public game_file_tree_map = new Map<string, FileTreeItemGui>();

  public componentDidMount(): void {
    this.tr_file_tree_map.clear();
    this.game_file_tree_map.clear();
    let { app } = this.context;
    app.event_project_opened.on(this.on_project_opened);
    app.event_project_closed.on(this.on_project_closed);
    app.event_current_tab_change.on(this.on_current_tab_change);
  }

  public componentWillUnmount(): void {
    this.tr_file_tree_map.clear();
    this.game_file_tree_map.clear();
    let { app } = this.context;
    app.event_project_opened.off(this.on_project_opened);
    app.event_project_closed.off(this.on_project_closed);
    app.event_current_tab_change.off(this.on_current_tab_change);
  }

  private on_project_opened = (): void => {
    this.forceUpdate();
  };

  private on_project_closed = (): void => {
    this.forceUpdate();
  };

  private on_current_tab_change = (triggered_from_tree: boolean): void => {
    let { app } = this.context;

    if (this.prev_game_file_path != null) {
      let prev_tree_item_gui = this.game_file_tree_map.get(this.prev_game_file_path);
      prev_tree_item_gui?.setState({ is_opened: false });
    }
    this.prev_game_file_path = null;

    if (app.current_tab_opened_file != null) {
      let full_path = app.current_tab_opened_file.path;
      this.prev_game_file_path = full_path;

      let component_start_index = 0;
      while (component_start_index < full_path.length) {
        let separator_index = full_path.indexOf('/', component_start_index);
        let is_last_component = separator_index < 0;
        let component_end_index = is_last_component ? full_path.length : separator_index;
        let component_path = full_path.slice(0, component_end_index);

        let tree_item_gui = this.game_file_tree_map.get(component_path);
        // Remember that setState is synchronous in Inferno. By the time the
        // path splitting loop reaches the next iteration, this tree item
        // component will have already been rendered, and its children will
        // have already been inserted into our map. For React we would've had
        // to wait for the callback of setState to be called until resuming
        // iteration.
        utils.assert(tree_item_gui != null);
        if (!tree_item_gui.state.is_opened) {
          tree_item_gui.setState({ is_opened: true });
        }
        if (is_last_component && !triggered_from_tree) {
          tree_item_gui.root_ref.current!.scrollIntoView({ block: 'center', inline: 'center' });
        }

        component_start_index = component_end_index + 1;
      }
    }
  };

  public render(): JSX.Element {
    let { app } = this.context;
    return (
      <BoxGui orientation="vertical" className="ProjectTree">
        <div className="ProjectTree-Header">
          <IconGui icon={null} /> PROJECT [
          {app.current_project_meta?.translation_locale ?? 'loading...'}]
        </div>

        <ProjectTreeSectionGui name="Translation files">
          <FileTreeGui
            map={this.tr_file_tree_map}
            path_prefix=""
            tree_data={app.project_tr_files_tree}
            files_icon="file-earmark-zip"
            depth={0}
          />
        </ProjectTreeSectionGui>

        <ProjectTreeSectionGui name="Game files" default_opened>
          <FileTreeGui
            map={this.game_file_tree_map}
            path_prefix=""
            tree_data={app.project_game_files_tree}
            files_icon="file-earmark-text"
            depth={0}
          />
        </ProjectTreeSectionGui>
      </BoxGui>
    );
  }
}

export interface ProjectTreeSectionGuiProps {
  name: string;
  default_opened?: boolean;
}

export interface ProjectTreeSectionGuiState {
  is_opened: boolean;
}

export class ProjectTreeSectionGui extends Inferno.Component<
  ProjectTreeSectionGuiProps,
  ProjectTreeSectionGuiState
> {
  public state: ProjectTreeSectionGuiState = {
    is_opened: this.props.default_opened ?? false,
  };

  private on_name_click = (): void => {
    this.setState({ is_opened: !this.state.is_opened });
  };

  public render(): JSX.Element {
    let { is_opened } = this.state;
    return (
      <BoxGui
        orientation="vertical"
        className={cc('ProjectTreeSection', {
          'ProjectTreeSection-opened': is_opened,
          'BoxItem-expand': is_opened,
        })}>
        <div>
          <button
            type="button"
            className="block ProjectTreeSection-Name ProjectTreeItem"
            tabIndex={0}
            onClick={this.on_name_click}>
            <IconGui icon={`chevron-${is_opened ? 'down' : 'right'}`} /> {this.props.name}
          </button>
        </div>
        {is_opened ? <WrapperGui scroll>{this.props.children}</WrapperGui> : null}
      </BoxGui>
    );
  }
}

export interface FileTreeGuiProps {
  map: Map<string, FileTreeItemGui>;
  path_prefix: string;
  tree_data: PathTree;
  files_icon: string;
  depth: number;
}

export function FileTreeGui(props: FileTreeGuiProps): JSX.Element {
  return <>{FileTreeItemGui.render_children(props, [])}</>;
}

export interface FileTreeItemGuiProps extends FileTreeGuiProps {
  name: string;
  default_opened?: boolean;
}

export interface FileTreeItemGuiState {
  full_path: string;
  is_opened: boolean;
}

export class FileTreeItemGui extends Inferno.Component<FileTreeItemGuiProps, FileTreeItemGuiState> {
  public context!: AppMainGuiCtx;
  public state: FileTreeItemGuiState = {
    full_path: '',
    is_opened: this.props.default_opened ?? false,
  };

  public root_ref = Inferno.createRef<HTMLButtonElement>();

  private is_directory(): boolean {
    return this.props.tree_data.size > 0;
  }

  public static getDerivedStateFromProps(
    props: FileTreeItemGuiProps,
  ): Partial<FileTreeItemGuiState> {
    return { full_path: `${props.path_prefix}${props.name}` };
  }

  public componentDidMount(): void {
    this.props.map.set(this.state.full_path, this);
  }

  public componentWillUnmount(): void {
    this.props.map.delete(this.state.full_path);
  }

  private on_click = (_event: Inferno.InfernoMouseEvent<HTMLButtonElement>): void => {
    let { app } = this.context;
    if (this.is_directory()) {
      this.setState({ is_opened: !this.state.is_opened });
    } else {
      app.open_game_file(this.state.full_path, /* triggered_from_tree */ true);
    }
  };

  public render(): JSX.Element[] {
    let is_directory = this.is_directory();
    let { name } = this.props;
    let { full_path } = this.state;
    let key = full_path;
    if (this.is_directory()) full_path += '/';
    let icon = is_directory
      ? `chevron-${this.state.is_opened ? 'down' : 'right'}`
      : this.props.files_icon;

    let elements = [
      <button
        key={key}
        ref={this.root_ref}
        type="button"
        className={cc('block', 'ProjectTreeItem', {
          'ProjectTreeItem-current': !is_directory && this.state.is_opened,
        })}
        style={{ '--ProjectTreeItem-depth': this.props.depth }}
        title={full_path}
        tabIndex={0}
        onClick={this.on_click}>
        {
          // Note that a nested div for enabling ellipsis is necessary,
          // otherwise the tree item shrinks when the enclosing list begins
          // overflowing.
        }
        <LabelGui block ellipsis>
          <IconGui icon={icon} /> {name}
        </LabelGui>
      </button>,
    ];

    if (this.state.is_opened && is_directory) {
      FileTreeItemGui.render_children({ ...this.props, path_prefix: full_path }, elements);
    }
    return elements;
  }

  public static render_children(props: FileTreeGuiProps, elements: JSX.Element[]): JSX.Element[] {
    let dir_elements: JSX.Element[] = [];
    let file_elements: JSX.Element[] = [];

    for (let [subtree_name, subtree_data] of props.tree_data) {
      let subtree_is_directory = subtree_data.size > 0;
      (subtree_is_directory ? dir_elements : file_elements).push(
        <FileTreeItemGui
          map={props.map}
          key={`${props.path_prefix}${subtree_name}`}
          path_prefix={props.path_prefix}
          name={subtree_name}
          tree_data={subtree_data}
          files_icon={props.files_icon}
          depth={props.depth + 1}
        />,
      );
    }

    elements.push(...dir_elements);
    elements.push(...file_elements);
    return elements;
  }
}
