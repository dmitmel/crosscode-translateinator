import './EditorTabs.scss';

import cc from 'clsx';
import * as React from 'react';

import {
  BaseTabRoData,
  TabChangeTrigger,
  TabFileRoData,
  TabQueueRoData,
  TabSearchRoData,
} from '../app';
import * as utils from '../utils';
import { AppMainCtx } from './AppMainCtx';
import { HBoxGui } from './Box';
import { FileTypeGuiData } from './Explorer';
import { IconGui } from './Icon';

export const TAB_RENDERER_SYM = Symbol('TabRenderer');

export interface EditorTabListGuiProps {
  className?: string;
}

export interface EditorTabListGuiState {
  current_tab_index: number;
  opened_tabs: readonly BaseTabRoData[];
}

export class EditorTabListGui extends React.Component<
  EditorTabListGuiProps,
  EditorTabListGuiState
> {
  public static override contextType = AppMainCtx;
  public override context!: AppMainCtx;
  public override state: Readonly<EditorTabListGuiState> = {
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

  public override render(): React.ReactNode {
    return (
      <HBoxGui scroll className={cc(this.props.className, 'EditorTabList')}>
        {this.state.opened_tabs.map((tab, index) => {
          let renderer = new tab[TAB_RENDERER_SYM]();
          return (
            <EditorTabGui
              {...renderer.prepare_to_render(tab)}
              key={tab.ref.obj_id}
              map={this.map}
              index={index}
              tab={tab}
              is_active={index === this.state.current_tab_index}
            />
          );
        })}
      </HBoxGui>
    );
  }
}

export interface TabRenderer {
  prepare_to_render(tab: BaseTabRoData): EditorTabGuiDisplayProps;
}

declare module '../app' {
  interface BaseTabRoData {
    [TAB_RENDERER_SYM]: new () => TabRenderer;
  }
}

BaseTabRoData.prototype[TAB_RENDERER_SYM] = class BaseTabRenderer implements TabRenderer {
  public prepare_to_render(tab: BaseTabRoData): EditorTabGuiDisplayProps {
    throw new Error(`no renderer found for tab type: ${tab.constructor.name}`);
  }
};

TabFileRoData.prototype[TAB_RENDERER_SYM] = class TabFileRenderer implements TabRenderer {
  public prepare_to_render(tab: TabFileRoData): EditorTabGuiDisplayProps {
    let gui_data = FileTypeGuiData.get(tab.file_type, tab.file_path);

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
      icon: gui_data.icon_filled,
      title: display_path,
      description: gui_data.description,
    };
  }
};

TabQueueRoData.prototype[TAB_RENDERER_SYM] = class TabQueueRenderer implements TabRenderer {
  public prepare_to_render(_tab: TabQueueRoData): EditorTabGuiDisplayProps {
    return { icon: 'journal-bookmark-fill', title: 'Queue' };
  }
};

TabSearchRoData.prototype[TAB_RENDERER_SYM] = class TabSearchRenderer implements TabRenderer {
  public prepare_to_render(_tab: TabSearchRoData): EditorTabGuiDisplayProps {
    return { icon: 'search', title: 'Search' };
  }
};

export interface EditorTabGuiDisplayProps {
  className?: string;
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

export class EditorTabGui extends React.Component<EditorTabGuiProps, unknown> {
  public static override contextType = AppMainCtx;
  public override context!: AppMainCtx;

  public root_ref = React.createRef<HTMLButtonElement>();

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

  public on_click = (_event: React.MouseEvent<HTMLButtonElement>): void => {
    let { app } = this.context;
    if (app.current_tab_index !== this.props.index) {
      app.set_current_tab_index(this.props.index, TabChangeTrigger.TabList);
    }
  };

  public on_close_click = (event: React.MouseEvent<HTMLSpanElement>): void => {
    event.stopPropagation();
    let { app } = this.context;
    app.close_tab(this.props.index);
  };

  public override render(): React.ReactNode {
    return (
      <button
        ref={this.root_ref}
        type="button"
        className={cc(this.props.className, 'EditorTab', {
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
