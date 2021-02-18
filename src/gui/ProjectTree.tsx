import * as Inferno from 'inferno';
import './ProjectTree.scss';
import { BoxGui } from './Box';
import { AppMainGuiCtx } from './AppMain';
import { IconGui } from './Icon';
import cc from 'classcat';

export interface ProjectTreeGuiState {
  translation_locale: string | null;
}

export class ProjectTreeGui extends Inferno.Component<unknown, unknown> {
  public context!: AppMainGuiCtx;
  public state: ProjectTreeGuiState = {
    translation_locale: null,
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

  private on_project_opened = (): void => {
    let { app } = this.context;
    this.setState({ translation_locale: app.current_project_meta?.translation_locale });
  };

  private on_project_closed = (): void => {
    this.setState({ translation_locale: null });
  };

  public render(): JSX.Element {
    let translation_locale = this.state.translation_locale ?? 'loading...';
    return (
      <BoxGui orientation="vertical" className="ProjectTree">
        <div className="ProjectTree-Header">PROJECT [{translation_locale}]</div>
        <ProjectTreeSectionGui name="Translation files">
          <FileTreeGui />
        </ProjectTreeSectionGui>
        <ProjectTreeSectionGui name="Game files">
          <FileTreeGui />
        </ProjectTreeSectionGui>
      </BoxGui>
    );
  }
}

export interface ProjectTreeSectionGuiProps extends Inferno.Props<typeof ProjectTreeSectionGui> {
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
          <IconGui name={is_opened ? 'chevron-down' : 'chevron-right'} /> {this.props.name}
        </div>
        {is_opened ? this.props.children : null}
      </BoxGui>
    );
  }
}

export class FileTreeGui extends Inferno.Component<unknown, unknown> {
  public render(): JSX.Element {
    return <div className="ProjectTreeItem">Hi!</div>;
  }
}
