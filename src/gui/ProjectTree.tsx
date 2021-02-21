import * as Inferno from 'inferno';
import './ProjectTree.scss';
import { BoxGui } from './Box';
import { AppMainGuiCtx } from './AppMain';
import { IconGui } from './Icon';
import cc from 'classcat';

export interface ProjectTreeGuiState {
  translation_locale: string | null;
  translation_files: PathTree | null;
  virtual_game_files: PathTree | null;
}

export class ProjectTreeGui extends Inferno.Component<unknown, unknown> {
  public context!: AppMainGuiCtx;
  public state: ProjectTreeGuiState = {
    translation_locale: null,
    translation_files: null,
    virtual_game_files: null,
  };

  public componentDidMount(): void {
    let { app } = this.context;
    app.events.project_opened.on(this.on_project_opened);
    app.events.project_closed.on(this.on_project_closed);
  }

  public componentWillUnmount(): void {
    let { app } = this.context;
    app.events.project_opened.off(this.on_project_opened);
    app.events.project_closed.off(this.on_project_closed);
  }

  private on_project_opened = async (): Promise<void> => {
    let { app } = this.context;
    this.setState({ translation_locale: app.current_project_meta!.translation_locale });

    {
      let response = await app.backend.send_request<'Project/list_tr_files'>({
        type: 'Project/list_tr_files',
        project_id: app.current_project_id!,
      });
      this.setState({ translation_files: paths_list_to_tree(response.paths) });
    }

    {
      let response = await app.backend.send_request<'Project/list_virtual_game_files'>({
        type: 'Project/list_virtual_game_files',
        project_id: app.current_project_id!,
      });
      this.setState({ virtual_game_files: paths_list_to_tree(response.paths) });
    }
  };

  private on_project_closed = (): void => {
    this.setState({
      translation_locale: null,
      translation_files: null,
      virtual_game_files: null,
    });
  };

  public render(): JSX.Element {
    let translation_locale = this.state.translation_locale ?? 'loading...';
    return (
      <BoxGui orientation="vertical" className="ProjectTree">
        <div className="ProjectTree-Header">
          <IconGui icon={null} /> PROJECT [{translation_locale}]
        </div>

        <ProjectTreeSectionGui name="Translation files">
          {this.state.translation_files != null
            ? render_FileTreeGui({
                path_prefix: '',
                tree_data: this.state.translation_files,
                depth: 0,
              })
            : null}
        </ProjectTreeSectionGui>

        <ProjectTreeSectionGui name="Game files">
          {this.state.virtual_game_files != null
            ? render_FileTreeGui({
                path_prefix: '',
                tree_data: this.state.virtual_game_files,
                depth: 0,
              })
            : null}
        </ProjectTreeSectionGui>
      </BoxGui>
    );
  }
}

export interface ProjectTreeSectionGuiProps {
  name: string;
}

export interface ProjectTreeSectionGuiState {
  is_opened: boolean;
}

export class ProjectTreeSectionGui extends Inferno.Component<ProjectTreeSectionGuiProps, unknown> {
  public state: ProjectTreeSectionGuiState = {
    is_opened: false,
  };

  private on_name_click = (): void => {
    this.setState({ is_opened: !this.state.is_opened });
  };

  public render(): JSX.Element {
    let { is_opened } = this.state;
    return (
      <BoxGui
        orientation="vertical"
        className={cc({
          ProjectTreeSection: true,
          'ProjectTreeSection-opened': is_opened,
          'BoxItem-expand': is_opened,
        })}>
        <div
          className="ProjectTreeSection-Name ProjectTreeItem"
          tabIndex={0}
          onClick={this.on_name_click}>
          <IconGui icon={`chevron-${is_opened ? 'down' : 'right'}`} /> {this.props.name}
        </div>
        {is_opened ? (
          // TODO: use a simple div with overflow: auto
          <BoxGui orientation="vertical" scroll>
            {this.props.children}
          </BoxGui>
        ) : null}
      </BoxGui>
    );
  }
}

export interface FileTreeGuiProps {
  path_prefix: string;
  tree_data: PathTree;
  depth: number;
}

export function render_FileTreeGui(
  props: FileTreeGuiProps,
  elements: JSX.Element[] = [],
): JSX.Element[] {
  let dir_elements: JSX.Element[] = [];
  let file_elements: JSX.Element[] = [];

  for (let [subtree_name, subtree_data] of props.tree_data) {
    let subtree_is_directory = subtree_data.size > 0;
    (subtree_is_directory ? dir_elements : file_elements).push(
      <FileTreeItemGui
        key={`${props.path_prefix}${subtree_name}`}
        path_prefix={props.path_prefix}
        name={subtree_name}
        tree_data={subtree_data}
        depth={props.depth + 1}
      />,
    );
  }

  elements.push(...dir_elements);
  elements.push(...file_elements);
  return elements;
}

export interface FileTreeItemGuiProps extends FileTreeGuiProps {
  name: string;
  default_opened?: boolean;
}

export interface FileTreeItemGuiState {
  is_opened: boolean;
}

export class FileTreeItemGui extends Inferno.Component<FileTreeItemGuiProps, unknown> {
  public state: FileTreeItemGuiState = {
    is_opened: this.props.default_opened ?? false,
  };

  private on_click = (): void => {
    this.setState({ is_opened: !this.state.is_opened });
  };

  public render(): JSX.Element[] {
    let is_directory = this.props.tree_data.size > 0;
    let { name } = this.props;
    let full_path = `${this.props.path_prefix}${name}`;
    if (is_directory) {
      full_path += '/';
      name += '/';
    }
    let icon = is_directory
      ? `chevron-${this.state.is_opened ? 'down' : 'right'}`
      : 'file-earmark-text';

    let elements = [
      <div
        key={full_path}
        class="ProjectTreeItem"
        style={{ '--ProjectTreeItem-depth': this.props.depth }}
        title={full_path}
        tabIndex={0}
        onClick={this.on_click}>
        <IconGui icon={icon} /> {name}
      </div>,
    ];

    if (this.state.is_opened && is_directory) {
      render_FileTreeGui({ ...this.props, path_prefix: full_path }, elements);
    }
    return elements;
  }
}

export type PathTree = Map<string, PathTree>;
export function paths_list_to_tree(paths: string[]): PathTree {
  let root_dir: PathTree = new Map();

  for (let path of paths) {
    let current_dir: PathTree = root_dir;
    for (let component of path.split('/')) {
      let next_dir = current_dir.get(component);
      if (next_dir == null) {
        next_dir = new Map();
        current_dir.set(component, next_dir);
      }
      current_dir = next_dir;
    }
  }

  return root_dir;
}
