/* eslint-disable no-cond-assign */

import './Explorer.scss';
import './Button';

import cc from 'clsx';
import * as Inferno from 'inferno';

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
        {is_opened ? <WrapperGui scroll>{this.props.children}</WrapperGui> : null}
      </BoxGui>
    );
  }
}

export interface TreeViewGuiProps {
  tree: FileTree;
  files_type: FileType;
  base_depth?: number;
}

class TreeViewGui extends Inferno.Component<TreeViewGuiProps, unknown> {
  public override context!: AppMainGuiCtx;

  public item_guis_map = new Map<string, HTMLButtonElement>();

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

  public override componentDidMount(): void {
    let { app } = this.context;
    app.event_current_tab_change.on(this.on_current_tab_change);
    this.on_current_tab_change(null);
  }

  public override componentWillUnmount(): void {
    let { app } = this.context;
    app.event_current_tab_change.off(this.on_current_tab_change);
  }

  private on_current_tab_change = (trigger: TabChangeTrigger | null): void => {
    let { app } = this.context;
    let tab = app.current_tab;
    if (tab instanceof TabFile && tab.file_type === this.props.files_type) {
      // this.should_scroll_into_view = !triggered_from_file_tree;
      this.set_current(tab.file_path);
      if (trigger !== TabChangeTrigger.FileTree) {
        let element = this.item_guis_map.get(tab.file_path);
        element?.scrollIntoView({ block: 'center', inline: 'center' });
      }
    } else {
      this.set_current(null);
    }
  };

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

  public override render(): JSX.Element {
    this.current_item_index = 0;
    this.next_opened_states.clear();

    let elements: JSX.Element[] = [];
    this.render_items(this.props.tree.root_dir, this.props.base_depth ?? 0, 0, elements);

    let prev_opened_states = this.opened_states;
    this.opened_states = this.next_opened_states;
    prev_opened_states.clear();
    this.next_opened_states = prev_opened_states;

    return <>{elements}</>;
  }

  private current_item_index = 0;
  private render_items(
    dir: FileTreeDir,
    depth: number,
    visible_start_index: number,
    out_elements: JSX.Element[],
  ): void {
    let files: FileTreeFile[] = [];

    // TODO: sorting

    for (let path of dir.children) {
      let subdir: FileTreeDir | undefined;
      let file: FileTreeFile | undefined;

      if ((subdir = this.props.tree.dirs.get(path)) != null) {
        if (this.current_item_index >= visible_start_index) {
          out_elements.push(this.render_item(subdir, depth));
        }
        this.current_item_index++;
        if (this.is_opened(subdir.path)) {
          this.render_items(subdir, depth + 1, visible_start_index, out_elements);
        }
      } else if ((file = this.props.tree.files.get(path)) != null) {
        files.push(file);
      } else {
        throw new Error(`Unknown file: ${path}`);
      }
    }

    for (let file of files) {
      if (this.current_item_index >= visible_start_index) {
        out_elements.push(this.render_item(file, depth));
      }
      this.current_item_index++;
    }
  }

  private render_item(file: FileTreeFile, depth: number): JSX.Element {
    let is_directory = file instanceof FileTreeDir;

    let is_opened = this.is_opened(file.path);
    this.next_opened_states.set(file.path, is_opened);

    let icon: string;
    let label = file.path;
    if (is_directory) {
      label += '/';
      icon = `chevron-${is_opened ? 'down' : 'right'}`;
    } else if (this.props.files_type === FileType.TrFile) {
      icon = 'file-earmark-zip';
    } else if (this.props.files_type === FileType.GameFile) {
      icon = 'file-earmark-text';
    } else {
      throw new Error('unreachable');
    }

    return (
      <button
        key={file.path}
        ref={(element: HTMLButtonElement | null): void => {
          if (element != null) {
            this.item_guis_map.set(file.path, element);
          } else {
            this.item_guis_map.delete(file.path);
          }
        }}
        type="button"
        className={cc('block', 'TreeItem', {
          'TreeItem-current': !is_directory && is_opened,
        })}
        style={{ '--TreeItem-depth': depth }}
        title={label}
        tabIndex={0}
        onClick={Inferno.linkEvent(file, this.on_item_click)}>
        {
          // Note that a nested div for enabling ellipsis is necessary,
          // otherwise the tree item shrinks when the enclosing list begins
          // overflowing.
        }
        <LabelGui block ellipsis>
          <IconGui icon={icon} /> {this.current_item_index}: {file.name}
        </LabelGui>
      </button>
    );
  }
}
