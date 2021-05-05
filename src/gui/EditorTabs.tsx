import './EditorTabs.scss';

import cc from 'clsx';
import * as Inferno from 'inferno';

import { OpenedFile, OpenedFileType, TAB_QUEUE_INDEX, TAB_SEARCH_INDEX } from '../app';
import * as utils from '../utils';
import { AppMainGuiCtx } from './AppMain';
import { BoxGui } from './Box';
import { IconGui } from './Icon';

export interface EditorTabListGuiProps {
  className?: string;
}

export class EditorTabListGui extends Inferno.Component<EditorTabListGuiProps, unknown> {
  public context!: AppMainGuiCtx;

  public componentDidMount(): void {
    let { app } = this.context;
    app.event_file_opened.on(this.on_opened_files_list_change);
    app.event_file_closed.on(this.on_opened_files_list_change);
  }

  public componentWillUnmount(): void {
    let { app } = this.context;
    app.event_file_opened.off(this.on_opened_files_list_change);
    app.event_file_closed.off(this.on_opened_files_list_change);
  }

  private on_opened_files_list_change = (): void => {
    this.forceUpdate();
  };

  public render(): JSX.Element {
    let { app } = this.context;
    return (
      <BoxGui orientation="horizontal" scroll className={cc(this.props.className, 'EditorTabList')}>
        <EditorTabGui icon="search" name="Search" index={TAB_SEARCH_INDEX} />
        <EditorTabGui icon="journal-bookmark-fill" name="Queue" index={TAB_QUEUE_INDEX} />
        {app.opened_files.map((file, index) => (
          <EditorFileTabGui key={`${file.type}:${file.path}`} file={file} index={index} />
        ))}
      </BoxGui>
    );
  }
}

export interface EditorTabGuiProps {
  icon: string | null;
  name: string;
  description?: string;
  index: number;
  closeable?: boolean;
}

export class EditorTabGui extends Inferno.Component<EditorTabGuiProps, unknown> {
  public context!: AppMainGuiCtx;

  public root_ref = Inferno.createRef<HTMLButtonElement>();

  public componentDidMount(): void {
    let { app } = this.context;
    // TODO: rewrite with a WeakMap or something
    app.event_current_tab_change.on(this.on_current_tab_change);
  }

  public componentWillUnmount(): void {
    let { app } = this.context;
    app.event_current_tab_change.off(this.on_current_tab_change);
  }

  private on_current_tab_change = (): void => {
    this.forceUpdate();
    let { app } = this.context;
    if (app.current_tab_index === this.props.index) {
      this.root_ref.current!.scrollIntoView({ block: 'center', inline: 'center' });
    }
  };

  public on_click = (_event: Inferno.InfernoMouseEvent<HTMLButtonElement>): void => {
    let { app } = this.context;
    app.set_current_tab_index(this.props.index);
  };

  public on_close_click = (event: Inferno.InfernoMouseEvent<SVGSVGElement>): void => {
    event.stopPropagation();
    let { app } = this.context;
    if (this.props.closeable) {
      app.close_game_file(this.props.index);
    }
  };

  public render(): JSX.Element {
    let { app } = this.context;
    return (
      <button
        ref={this.root_ref}
        type="button"
        className={cc('EditorTab', {
          'EditorTab-active': this.props.index === app.current_tab_index,
          'EditorTab-closeable': this.props.closeable,
        })}
        onClick={this.on_click}
        title={this.props.description ?? this.props.name}>
        <IconGui icon={this.props.icon} className="EditorTab-Icon" />
        {` ${this.props.name} `}
        <IconGui
          icon="x"
          className="EditorTab-Close"
          title={this.props.closeable ? 'Close this tab' : "This tab can't be closed!"}
          onClick={this.on_close_click}
        />
      </button>
    );
  }
}

export interface EditorFileTabGuiProps {
  file: OpenedFile;
  index: number;
}

export class EditorFileTabGui extends Inferno.Component<EditorFileTabGuiProps, unknown> {
  public render(): JSX.Element {
    let { file } = this.props;

    let icon;
    let description;
    if (file.type === OpenedFileType.GameFile) {
      icon = 'file-earmark-zip-fill';
      description = `GameFile ${file.path}`;
    } else if (file.type === OpenedFileType.TrFile) {
      icon = 'file-earmark-text-fill';
      description = `TrFile ${file.path}`;
    } else {
      throw new Error(`unknown OpenedFile type: ${file.type}`);
    }

    // Almost all paths you'll ever see begin with `data/` anyway.
    let shorter_path = utils.strip_prefix(file.path, 'data/');
    // The path shortener was inspired by Vim's pathshorten() function, see
    // <https://neovim.io/doc/user/eval.html#pathshorten()>.
    let display_path = '';
    let component_start = 0;
    while (component_start < shorter_path.length) {
      let separator_index = shorter_path.indexOf('/', component_start);
      let is_last_component = separator_index < 0;
      let component_end = is_last_component ? shorter_path.length : separator_index;
      let component = shorter_path.slice(component_start, component_end);
      if (is_last_component) {
        display_path += component;
      } else {
        display_path += component.charAt(0);
        display_path += '/';
      }
      component_start = component_end + 1;
    }

    return (
      <EditorTabGui
        icon={icon}
        name={display_path}
        description={description}
        index={this.props.index}
        closeable
      />
    );
  }
}
