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
        {this.state.translation_files != null ? (
          <ProjectTreeSectionGui name="Translation files">
            <FileTreeGui data={this.state.translation_files} />
          </ProjectTreeSectionGui>
        ) : null}
        {this.state.virtual_game_files != null ? (
          <ProjectTreeSectionGui name="Game files">
            <FileTreeGui data={this.state.virtual_game_files} />
          </ProjectTreeSectionGui>
        ) : null}
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
          <IconGui icon={is_opened ? 'chevron-down' : 'chevron-right'} /> {this.props.name}
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
  data: PathTree;
}

export class FileTreeGui extends Inferno.Component<FileTreeGuiProps, unknown> {
  public render(): JSX.Element {
    let elements: JSX.Element[] = [];
    this.render_tree(this.props.data, [], elements);
    return <Inferno.Fragment $HasKeyedChildren>{elements}</Inferno.Fragment>;
  }

  private render_tree(tree: PathTree, stack: string[], dst: JSX.Element[]): void {
    for (let [subtree_name, subtree] of tree) {
      let depth = stack.length;
      stack.push(subtree_name);
      let full_path = stack.join('/');
      let is_directory = subtree.size > 0;

      dst.push(
        <div
          key={full_path}
          class="ProjectTreeItem"
          style={{ 'padding-left': `${depth * 8 + 6}px` }}
          title={full_path}
          tabIndex={0}>
          <IconGui icon={is_directory ? 'folder2-open' : 'file-earmark-text'} /> {subtree_name}
        </div>,
      );

      if (is_directory) {
        this.render_tree(subtree, stack, dst);
      }
      stack.pop();
    }
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
