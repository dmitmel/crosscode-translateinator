import './ProjectTree.scss';
import './Button';

import cc from 'clsx';
import * as Inferno from 'inferno';

import { FileTree, FileTreeDir, FileTreeFile, OpenedGameFile, TabFile } from '../app';
import * as utils from '../utils';
import { AppMainGuiCtx } from './AppMain';
import { BoxGui, WrapperGui } from './Box';
import { IconGui } from './Icon';
import { LabelGui } from './Label';

export class ProjectTreeGui extends Inferno.Component<unknown, unknown> {
  public override context!: AppMainGuiCtx;

  public tr_files_section_ref = Inferno.createRef<ProjectTreeSectionGui>();
  public game_files_section_ref = Inferno.createRef<ProjectTreeSectionGui>();

  public prev_tr_file_path: string | null = null;
  public tr_file_tree_map = new Map<string, FileTreeItemGui>();
  public prev_game_file_path: string | null = null;
  public game_file_tree_map = new Map<string, FileTreeItemGui>();

  public override componentDidMount(): void {
    this.tr_file_tree_map.clear();
    this.game_file_tree_map.clear();
    let { app } = this.context;
    app.event_project_opened.on(this.on_project_opened);
    app.event_project_closed.on(this.on_project_closed);
    app.event_current_tab_change.on(this.on_current_tab_change);
  }

  public override componentWillUnmount(): void {
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

  private on_current_tab_change = (triggered_from_file_tree: boolean): void => {
    let { app } = this.context;

    if (this.prev_game_file_path != null) {
      let prev_tree_item_gui = this.game_file_tree_map.get(this.prev_game_file_path);
      prev_tree_item_gui?.setState({ is_opened: false });
    }
    this.prev_game_file_path = null;

    if (app.current_tab instanceof TabFile && app.current_tab.file instanceof OpenedGameFile) {
      let full_path = app.current_tab.file.path;
      this.prev_game_file_path = full_path;

      this.game_files_section_ref.current!.setState({ is_opened: true });

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
        if (is_last_component && !triggered_from_file_tree) {
          tree_item_gui.root_ref.current!.scrollIntoView({ block: 'center', inline: 'center' });
        }

        component_start_index = component_end_index + 1;
      }
    }
  };

  public override render(): JSX.Element {
    let { app } = this.context;
    return (
      <BoxGui orientation="vertical" className="ProjectTree">
        <div className="ProjectTree-Header">
          <IconGui icon={null} /> PROJECT [
          {app.current_project_meta?.translation_locale ?? 'loading...'}]
        </div>

        <ProjectTreeSectionGui
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={this.tr_files_section_ref as any}
          name="Translation files">
          <FileTreeGui
            map={this.tr_file_tree_map}
            tree={app.project_tr_files_tree}
            file={app.project_tr_files_tree.root_dir}
            files_icon="file-earmark-zip"
            depth={0}
          />
        </ProjectTreeSectionGui>

        <ProjectTreeSectionGui
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={this.game_files_section_ref as any}
          name="Game files"
          default_opened>
          <FileTreeGui
            map={this.game_file_tree_map}
            tree={app.project_game_files_tree}
            file={app.project_game_files_tree.root_dir}
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
  public override state: ProjectTreeSectionGuiState = {
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
  tree: FileTree;
  files_icon: string;
  depth: number;
}

export function FileTreeGui(props: FileTreeGuiProps & { file: FileTreeDir }): JSX.Element {
  return <>{FileTreeItemGui.render_children(props, props.file, [])}</>;
}

export interface FileTreeItemGuiProps extends FileTreeGuiProps {
  file: FileTreeFile;
  default_opened?: boolean;
}

export interface FileTreeItemGuiState {
  is_opened: boolean;
}

export class FileTreeItemGui extends Inferno.Component<FileTreeItemGuiProps, FileTreeItemGuiState> {
  public override context!: AppMainGuiCtx;
  public override state: FileTreeItemGuiState = {
    is_opened: this.props.default_opened ?? false,
  };

  public root_ref = Inferno.createRef<HTMLButtonElement>();

  public override componentDidMount(): void {
    this.register_into_container(this.props);
  }

  public override componentDidUpdate(prev_props: FileTreeItemGuiProps): void {
    this.unregister_from_container(prev_props);
    this.register_into_container(this.props);
  }

  public override componentWillUnmount(): void {
    this.unregister_from_container(this.props);
  }

  public register_into_container(props: FileTreeItemGuiProps): void {
    props.map.set(props.file.path, this);
  }

  public unregister_from_container(props: FileTreeItemGuiProps): void {
    props.map.delete(props.file.path);
  }

  private on_click = (_event: Inferno.InfernoMouseEvent<HTMLButtonElement>): void => {
    let { app } = this.context;
    if (this.props.file instanceof FileTreeDir) {
      this.setState({ is_opened: !this.state.is_opened });
    } else {
      app.open_game_file(this.props.file.path, /* triggered_from_file_tree */ true);
    }
  };

  public override render(): JSX.Element[] {
    let { file } = this.props;
    let is_directory = file instanceof FileTreeDir;
    let { name, path } = file;
    let key = path;
    if (is_directory) path += '/';
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
        title={path}
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

    if (this.state.is_opened && this.props.file instanceof FileTreeDir) {
      FileTreeItemGui.render_children(this.props, this.props.file, elements);
    }
    return elements;
  }

  public static render_children(
    props: FileTreeGuiProps,
    dir: FileTreeDir,
    out_elements: JSX.Element[],
  ): JSX.Element[] {
    let dir_elements: JSX.Element[] = [];
    let file_elements: JSX.Element[] = [];

    for (let path of dir.children) {
      let child: FileTreeFile | undefined;
      let dest_elements: JSX.Element[];

      /* eslint-disable no-cond-assign */
      if ((child = props.tree.dirs.get(path)) != null) {
        dest_elements = dir_elements;
      } else if ((child = props.tree.files.get(path)) != null) {
        dest_elements = file_elements;
      } else {
        throw new Error(`Unknown file: ${path}`);
      }
      /* eslint-enable no-cond-assign */

      dest_elements.push(
        <FileTreeItemGui {...props} key={child.path} file={child} depth={props.depth + 1} />,
      );
    }

    out_elements.push(...dir_elements);
    out_elements.push(...file_elements);
    return out_elements;
  }
}
