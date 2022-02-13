import './EditorTabs.scss';

import cc from 'clsx';
import * as preact from 'preact';

import {
  BaseTabRoData,
  FileType,
  TabChangeTrigger,
  TabFileRoData,
  TabQueueRoData,
  TabSearchRoData,
} from '../app';
import * as utils from '../utils';
import { AppMainGuiCtx } from './AppMain';
import { BoxGui } from './Box';
import { IconGui } from './Icon';

export interface EditorTabListGuiProps {
  className?: string;
}

export interface EditorTabListGuiState {
  readonly current_tab_index: number;
  readonly opened_tabs: readonly BaseTabRoData[];
}

export class EditorTabListGui extends preact.Component<
  EditorTabListGuiProps,
  EditorTabListGuiState
> {
  public override context!: AppMainGuiCtx;
  public override state: EditorTabListGuiState = {
    current_tab_index: this.context.app.current_tab_index,
    opened_tabs: this.context.app.opened_tabs.map((tab) => tab.get_render_data()),
  };
  public map = new WeakMap<BaseTabRoData, EditorTabGui>();

  public override componentDidMount(): void {
    let { app } = this.context;
    app.event_tab_opened.on(this.on_opened_tabs_list_change);
    app.event_tab_closed.on(this.on_opened_tabs_list_change);
    app.event_current_tab_change.on(this.on_current_tab_change);
  }

  public override componentWillUnmount(): void {
    let { app } = this.context;
    app.event_tab_opened.off(this.on_opened_tabs_list_change);
    app.event_tab_closed.off(this.on_opened_tabs_list_change);
    app.event_current_tab_change.off(this.on_current_tab_change);
  }

  private on_opened_tabs_list_change = (): void => {
    let { app } = this.context;
    this.setState({ opened_tabs: app.opened_tabs.map((tab) => tab.get_render_data()) });
  };

  private on_current_tab_change = (trigger: TabChangeTrigger | null): void => {
    let { app } = this.context;
    this.setState({ current_tab_index: app.current_tab_index }, () => {
      if (trigger !== TabChangeTrigger.TabList) {
        let new_tab = this.map.get(this.state.opened_tabs[this.state.current_tab_index]);
        new_tab!.root_ref.current!.scrollIntoView({ block: 'center', inline: 'center' });
      }
    });
  };

  public override render(): preact.VNode {
    return (
      <BoxGui orientation="horizontal" scroll className={cc(this.props.className, 'EditorTabList')}>
        {this.state.opened_tabs.map((tab, index) => {
          let props = this.prepare_to_render_tab(tab);
          return (
            <EditorTabGui
              {...props}
              key={tab.ref.obj_id}
              map={this.map}
              index={index}
              tab={tab}
              is_active={index === this.state.current_tab_index}
            />
          );
        })}
      </BoxGui>
    );
  }

  private prepare_to_render_tab(tab: BaseTabRoData): EditorTabGuiDisplayProps {
    if (tab instanceof TabFileRoData) {
      let icon: string;
      let description: string;
      if (tab.file_type === FileType.GameFile) {
        icon = 'file-earmark-zip-fill';
        description = `Game file ${tab.file_path}`;
      } else if (tab.file_type === FileType.TrFile) {
        icon = 'file-earmark-text-fill';
        description = `Translation file ${tab.file_path}`;
      } else {
        throw new Error(`unknown file type: ${tab.file_type}`);
      }

      // Almost all paths you'll ever see begin with `data/` anyway.
      let shorter_path = utils.strip_prefix(tab.file_path, 'data/');
      // The path shortener was inspired by Vim's pathshorten() function, see
      // <https://neovim.io/doc/user/eval.html#pathshorten()>.
      let display_path = '';
      for (let component of utils.split_iter(shorter_path, '/')) {
        if (component.is_last) {
          display_path += shorter_path.slice(component.start, component.end);
        } else {
          display_path += shorter_path.charAt(component.start);
          display_path += '/';
        }
      }

      return {
        icon,
        title: display_path,
        description,
      };
    } else if (tab instanceof TabQueueRoData) {
      return { icon: 'journal-bookmark-fill', title: 'Queue' };
    } else if (tab instanceof TabSearchRoData) {
      return { icon: 'search', title: 'Search' };
    } else {
      throw new Error(`unknown tab type: ${tab.constructor.name}`);
    }
  }
}

export interface EditorTabGuiDisplayProps {
  icon: string;
  title: string;
  description?: string;
}

export interface EditorTabGuiProps extends EditorTabGuiDisplayProps {
  map: WeakMap<BaseTabRoData, EditorTabGui>;
  index: number;
  tab: BaseTabRoData;
  is_active: boolean;
}

export class EditorTabGui extends preact.Component<EditorTabGuiProps, unknown> {
  public override context!: AppMainGuiCtx;

  public root_ref = preact.createRef<HTMLButtonElement>();

  public override componentDidMount(): void {
    this.register_into_container(this.props);
  }

  public override componentDidUpdate(prev_props: EditorTabGuiProps): void {
    this.unregister_from_container(prev_props);
    this.register_into_container(this.props);
  }

  public override componentWillUnmount(): void {
    this.unregister_from_container(this.props);
  }

  public register_into_container(props: EditorTabGuiProps): void {
    props.map.set(props.tab, this);
  }

  public unregister_from_container(props: EditorTabGuiProps): void {
    props.map.delete(props.tab);
  }

  public on_click = (_event: preact.JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
    let { app } = this.context;
    app.set_current_tab_index(this.props.index, TabChangeTrigger.TabList);
  };

  public on_close_click = (event: preact.JSX.TargetedMouseEvent<HTMLSpanElement>): void => {
    event.stopPropagation();
    let { app } = this.context;
    app.close_tab(this.props.index);
  };

  public override render(): preact.VNode {
    return (
      <button
        ref={this.root_ref}
        type="button"
        className={cc('EditorTab', {
          'EditorTab-active': this.props.is_active,
          'EditorTab-closeable': this.props.tab.is_closeable,
        })}
        onClick={this.on_click}
        title={this.props.description ?? this.props.title}>
        <IconGui icon={this.props.icon} className="EditorTab-Icon" />
        {` ${this.props.title} `}
        <IconGui
          icon="x"
          className="EditorTab-Close"
          title={this.props.tab.is_closeable ? 'Close this tab' : "This tab can't be closed!"}
          onClick={this.on_close_click}
        />
      </button>
    );
  }
}
