import './EditorTabs.scss';

import cc from 'clsx';
import * as Inferno from 'inferno';

import { EditorTab, TabFile, TabGameFile, TabQueue, TabSearch, TabTrFile } from '../app';
import * as utils from '../utils';
import { AppMainGuiCtx } from './AppMain';
import { BoxGui } from './Box';
import { IconGui } from './Icon';

export interface EditorTabListGuiProps {
  className?: string;
}

export class EditorTabListGui extends Inferno.Component<EditorTabListGuiProps, unknown> {
  public override context!: AppMainGuiCtx;
  private map = new WeakMap<EditorTab, EditorTabGui>();
  private prev_opened_tab_index = 0;

  public get_tab_gui_by_index(index: number): EditorTabGui | undefined {
    // get(null) will fall through, like in Lua
    return this.map.get(this.context.app.opened_tabs[index]);
  }

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
    this.forceUpdate();
  };

  private on_current_tab_change = (): void => {
    let { app } = this.context;

    let prev_tab = this.get_tab_gui_by_index(this.prev_opened_tab_index);
    prev_tab?.forceUpdate();
    this.prev_opened_tab_index = app.current_tab_index;

    let new_tab = this.get_tab_gui_by_index(app.current_tab_index);
    new_tab!.forceUpdate();
    new_tab!.root_ref.current!.scrollIntoView({ block: 'center', inline: 'center' });
  };

  public override render(): JSX.Element {
    let { app } = this.context;
    return (
      <BoxGui orientation="horizontal" scroll className={cc(this.props.className, 'EditorTabList')}>
        {app.opened_tabs.map((tab, index) => {
          let props = this.prepare_to_render_tab(tab);
          return <EditorTabGui {...props} map={this.map} index={index} tab={tab} />;
        })}
      </BoxGui>
    );
  }

  private prepare_to_render_tab(tab: EditorTab): { key: string } & EditorTabGuiDisplayProps {
    if (tab instanceof TabFile) {
      let icon: string;
      let description: string;
      if (tab instanceof TabTrFile) {
        icon = 'file-earmark-zip-fill';
        description = `GameFile ${tab.file_path}`;
      } else if (tab instanceof TabGameFile) {
        icon = 'file-earmark-text-fill';
        description = `TrFile ${tab.file_path}`;
      } else {
        throw new Error(`unknown TabFile type: ${tab.constructor.name}`);
      }

      // Almost all paths you'll ever see begin with `data/` anyway.
      let shorter_path = utils.strip_prefix(tab.file_path, 'data/');
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

      return {
        key: `${tab.constructor.name}:${tab.file_path}`,
        icon,
        title: display_path,
        description,
      };
    } else if (tab instanceof TabQueue) {
      return { key: tab.constructor.name, icon: 'journal-bookmark-fill', title: 'Queue' };
    } else if (tab instanceof TabSearch) {
      return { key: tab.constructor.name, icon: 'search', title: 'Search' };
    } else {
      throw new Error(`unknown EditorTab type: ${tab.constructor.name}`);
    }
  }
}

export interface EditorTabGuiDisplayProps {
  icon?: string;
  title: string;
  description?: string;
}

export interface EditorTabGuiProps extends EditorTabGuiDisplayProps {
  map: WeakMap<EditorTab, EditorTabGui>;
  index: number;
  tab: EditorTab;
}

export class EditorTabGui extends Inferno.Component<EditorTabGuiProps, unknown> {
  public override context!: AppMainGuiCtx;

  public root_ref = Inferno.createRef<HTMLButtonElement>();

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

  public on_click = (_event: Inferno.InfernoMouseEvent<HTMLButtonElement>): void => {
    let { app } = this.context;
    app.set_current_tab_index(this.props.index);
  };

  public on_close_click = (event: Inferno.InfernoMouseEvent<SVGSVGElement>): void => {
    event.stopPropagation();
    let { app } = this.context;
    app.close_tab(this.props.index);
  };

  public override render(): JSX.Element {
    let { app } = this.context;
    return (
      <button
        ref={this.root_ref}
        type="button"
        className={cc('EditorTab', {
          'EditorTab-active': this.props.index === app.current_tab_index,
          'EditorTab-closeable': this.props.tab.is_closeable(),
        })}
        onClick={this.on_click}
        title={this.props.description ?? this.props.title}>
        <IconGui icon={this.props.icon} className="EditorTab-Icon" />
        {` ${this.props.title} `}
        <IconGui
          icon="x"
          className="EditorTab-Close"
          title={this.props.tab.is_closeable() ? 'Close this tab' : "This tab can't be closed!"}
          onClick={this.on_close_click}
        />
      </button>
    );
  }
}
