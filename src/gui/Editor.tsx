import './Editor.scss';

import cc from 'clsx';
import * as React from 'react';

import { CurrentFragmentChangeTrigger, FragmentRoData, TranslationRoData } from '../app';
import * as gui from '../gui';
import * as utils from '../utils';
import { AppMainCtx } from './AppMainCtx';
import { BoxGui, BoxItemFillerGui, WrapperGui } from './Box';
import { IconButtonGui } from './Button';
import { EditorTabListGui } from './EditorTabs';
import { FancyTextGui } from './FancyText';
import { IconGui, IconlikeTextGui } from './Icon';
import { LabelGui } from './Label';
import { TextAreaGui } from './TextInput';
import { VirtListItemFnProps, VirtListScrollAlign, VirtualizedListGui } from './VirtualizedList';

export interface EditorGuiProps {
  className?: string;
}

export function EditorGui(props: EditorGuiProps): React.ReactElement {
  return (
    <BoxGui orientation="vertical" className={cc(props.className, 'Editor')}>
      <EditorTabListGui />
      <FragmentListToolbarGui />
      <FragmentListGui className="BoxItem-expand" />
    </BoxGui>
  );
}

export interface FragmentListGuiProps {
  className?: string;
}

export interface FragmentListGuiState {
  list: readonly FragmentRoData[];
  list_owner_id: number;
}

export type FragmentVirtListData = readonly FragmentRoData[];

export class FragmentListGui extends React.Component<FragmentListGuiProps, FragmentListGuiState> {
  public static override contextType = AppMainCtx;
  public override context!: AppMainCtx;
  public override state: Readonly<FragmentListGuiState> = {
    ...this.copy_fragment_list(),
  };

  private list_ref = React.createRef<VirtualizedListGui<FragmentVirtListData>>();

  public override componentDidMount(): void {
    let { app } = this.context;
    app.event_fragment_list_update.on(this.on_fragment_list_update);
    app.event_current_fragment_change.on(this.on_current_fragment_change);
  }

  public override componentWillUnmount(): void {
    let { app } = this.context;
    app.event_fragment_list_update.off(this.on_fragment_list_update);
    app.event_current_fragment_change.off(this.on_current_fragment_change);
  }

  private on_fragment_list_update = (): void => {
    this.setState(this.copy_fragment_list());
  };

  private copy_fragment_list(): Pick<FragmentListGuiState, 'list' | 'list_owner_id'> {
    let { app } = this.context;
    return {
      list: app.current_fragment_list.map((f) => f.get_render_data()),
      list_owner_id: app.current_fragment_list_owner?.obj_id ?? utils.new_gui_id(),
    };
  }

  private on_current_fragment_change = (trigger: CurrentFragmentChangeTrigger | null): void => {
    let { app } = this.context;
    if (trigger !== CurrentFragmentChangeTrigger.Scroll) {
      this.list_ref.current!.scroll_to_item(app.current_fragment_index, VirtListScrollAlign.Start);
    }
  };

  private on_items_rendered = (list: VirtualizedListGui<FragmentVirtListData>): void => {
    let { app } = this.context;
    if (app.current_fragment_index !== list.state.current_index) {
      app.set_current_fragment_index(list.state.current_index, CurrentFragmentChangeTrigger.Scroll);
    }
  };

  public override render(): React.ReactNode {
    return (
      <VirtualizedListGui
        key={this.state.list_owner_id}
        ref={this.list_ref}
        className={cc(this.props.className, 'FragmentList')}
        item_count={this.state.list.length}
        item_data={this.state.list}
        render_item={this.render_item}
        item_size={320}
        estimate_average_item_size
        overscan_count={3}
        last_page_behavior="one_last_item"
        on_items_rendered={this.on_items_rendered}
      />
    );
  }

  private render_item = (props: VirtListItemFnProps<FragmentVirtListData>): React.ReactNode => {
    let fragment = props.data[props.index];
    return (
      <FragmentGui
        key={fragment.ref.obj_id}
        list={props.list}
        fragment={fragment}
        index={props.index}
        is_current={props.index === props.list.state.current_index}
      />
    );
  };
}

export interface FragmentListToolbarGuiProps {
  className?: string;
}

export interface FragmentListToolbarGuiState {
  jump_pos_value: string;
  filter_value: string;
  fragment_count: number;
}

export class FragmentListToolbarGui extends React.Component<
  FragmentListToolbarGuiProps,
  FragmentListToolbarGuiState
> {
  public static override contextType = AppMainCtx;
  public override context!: AppMainCtx;
  public override state: Readonly<FragmentListToolbarGuiState> = {
    jump_pos_value: '0',
    filter_value: '',
    fragment_count: this.context.app.current_fragment_list.length,
  };

  public static readonly FRAGMENT_PAGINATION_JUMP = 10;

  private jump_pos_input_ref = React.createRef<HTMLInputElement>();
  private filter_input_ref = React.createRef<HTMLInputElement>();

  public override componentDidMount(): void {
    let { app } = this.context;
    app.event_fragment_list_update.on(this.on_fragment_list_update);
    app.event_current_fragment_change.on(this.on_current_fragment_change);
  }

  public override componentWillUnmount(): void {
    let { app } = this.context;
    app.event_fragment_list_update.off(this.on_fragment_list_update);
    app.event_current_fragment_change.off(this.on_current_fragment_change);
  }

  private on_current_fragment_change = (): void => {
    this.jump_pos_input_ref.current!.blur();
    this.set_current_fragment_text();
  };

  private set_current_fragment_text(): void {
    let { app } = this.context;
    this.setState({ jump_pos_value: (app.current_fragment_index + 1).toString() });
  }

  private on_fragment_list_update = (): void => {
    let { app } = this.context;
    this.setState({ fragment_count: app.current_fragment_list.length });
  };

  private on_jump_pos_input = (event: React.FormEvent<HTMLInputElement>): void => {
    this.setState({ jump_pos_value: event.currentTarget.value });
  };

  private on_jump_pos_submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    let { app } = this.context;
    let jump_pos = parseInt(this.state.jump_pos_value, 10);
    if (!Number.isSafeInteger(jump_pos)) return;
    app.set_current_fragment_index(jump_pos - 1, CurrentFragmentChangeTrigger.Jump);
  };

  private on_jump_pos_unfocus = (_event: React.FocusEvent<HTMLInputElement>): void => {
    this.set_current_fragment_text();
  };

  private on_jump_button_click = (
    jump_type: 'first' | 'back_many' | 'back_one' | 'fwd_one' | 'fwd_many' | 'last',
    _event: React.MouseEvent<HTMLButtonElement>,
  ): void => {
    let { app } = this.context;
    let jump_pos = app.current_fragment_index;
    let long_jump = FragmentListToolbarGui.FRAGMENT_PAGINATION_JUMP;
    let fragment_count = app.current_fragment_list.length;
    // prettier-ignore
    switch (jump_type) {
      case 'first':     { jump_pos  = 0;                break; }
      case 'back_many': { jump_pos -= long_jump;        break; }
      case 'back_one':  { jump_pos -= 1;                break; }
      case 'fwd_one':   { jump_pos += 1;                break; }
      case 'fwd_many':  { jump_pos += long_jump;        break; }
      case 'last':      { jump_pos  = fragment_count-1; break; }
    }
    jump_pos = utils.clamp(jump_pos, 0, fragment_count);
    app.set_current_fragment_index(jump_pos, CurrentFragmentChangeTrigger.Jump);
  };

  private on_filter_submit = (_event: React.FormEvent<HTMLFormElement>): void => {};

  private on_filter_input = (event: React.FormEvent<HTMLInputElement>): void => {
    this.setState({ filter_value: event.currentTarget.value });
  };

  public override render(): React.ReactNode {
    let long_jump = FragmentListToolbarGui.FRAGMENT_PAGINATION_JUMP;
    return (
      <WrapperGui className={cc('FragmentListToolbar', this.props.className)}>
        <BoxGui
          orientation="horizontal"
          align_items="center"
          className="FragmentListToolbar-Pagination">
          <IconButtonGui
            icon="chevron-bar-left"
            title="First"
            onClick={(event) => this.on_jump_button_click('first', event)}
          />
          <IconButtonGui
            icon="chevron-double-left"
            title={`Back by ${long_jump}`}
            onClick={(event) => this.on_jump_button_click('back_many', event)}
          />
          <IconButtonGui
            icon="chevron-left"
            title="Previous"
            onClick={(event) => this.on_jump_button_click('back_one', event)}
          />
          <form onSubmit={this.on_jump_pos_submit}>
            <input
              ref={this.jump_pos_input_ref}
              type="number"
              name="jump_pos"
              className="FragmentListToolbar-JumpInput"
              onInput={this.on_jump_pos_input}
              onBlur={this.on_jump_pos_unfocus}
              value={this.state.jump_pos_value}
              min={Math.min(1, this.state.fragment_count)}
              max={this.state.fragment_count}
              disabled={this.state.fragment_count === 0}
              title="Jump to..."
              autoComplete="off"
            />
          </form>
          <IconlikeTextGui icon="/" />
          <LabelGui selectable title="Total fragments">
            {this.state.fragment_count}
          </LabelGui>
          <IconButtonGui
            icon="chevron-right"
            title="Next"
            onClick={(event) => this.on_jump_button_click('fwd_one', event)}
          />
          <IconButtonGui
            icon="chevron-double-right"
            title={`Forward by ${long_jump}`}
            onClick={(event) => this.on_jump_button_click('fwd_many', event)}
          />
          <IconButtonGui
            icon="chevron-bar-right"
            title="Last"
            onClick={(event) => this.on_jump_button_click('last', event)}
          />
          <BoxItemFillerGui />
          <form onSubmit={this.on_filter_submit}>
            <input
              ref={this.filter_input_ref}
              type="filter"
              name="filter"
              className="FragmentListToolbar-Filter"
              onInput={this.on_filter_input}
              value={this.state.filter_value}
              title="Quick search"
              placeholder="Quick search..."
              autoComplete="off"
            />
          </form>
        </BoxGui>
      </WrapperGui>
    );
  }
}

export interface FragmentGuiProps {
  className?: string;
  index: number;
  is_current: boolean;
  fragment: FragmentRoData;
  list?: VirtualizedListGui<FragmentVirtListData>;
}

export class FragmentGui extends React.Component<FragmentGuiProps, unknown> {
  public static override contextType = AppMainCtx;
  public override context!: AppMainCtx;
  public root_ref = React.createRef<HTMLDivElement>();

  public override componentDidMount(): void {
    this.props.list?.on_item_mounted(this.props.index, this.root_ref.current!);
  }

  public override componentDidUpdate(prev_props: FragmentGuiProps): void {
    this.props.list?.on_item_updated(prev_props.index, this.props.index, this.root_ref.current!);
  }

  public override componentWillUnmount(): void {
    this.props.list?.on_item_unmounted(this.props.index, this.root_ref.current!);
  }

  private on_file_path_component_click = (component_path: string): void => {
    console.log('search', component_path);
  };

  private on_json_path_component_click = (component_path: string): void => {
    console.log('search', this.props.fragment.game_file_path, component_path);
  };

  private on_copy_original_text = (_event: React.MouseEvent<HTMLButtonElement>): void => {
    nw.Clipboard.get().set(this.props.fragment.original_text);
  };

  public override render(): React.ReactNode {
    let { fragment } = this.props;
    return (
      <WrapperGui
        ref={this.root_ref}
        allow_overflow
        className={cc(this.props.className, 'Fragment', {
          'Fragment-current': this.props.is_current,
        })}>
        <BoxGui
          orientation="horizontal"
          allow_wrapping
          allow_overflow
          className="Fragment-Location">
          <span title="File path" className="Fragment-FilePath">
            <IconGui icon="file-earmark-text" />{' '}
            <FragmentPathGui
              path={fragment.game_file_path}
              on_click={this.on_file_path_component_click}
            />
          </span>
          <span title="JSON path" className="Fragment-JsonPath">
            <IconGui icon="code" />{' '}
            <FragmentPathGui
              path={fragment.json_path}
              on_click={this.on_json_path_component_click}
            />
          </span>
          <span title="Position in the list" className="Fragment-Index">
            <IconlikeTextGui icon="#" /> <LabelGui selectable>{this.props.index + 1}</LabelGui>
          </span>
        </BoxGui>

        {fragment.description.length > 0 ? (
          <LabelGui block selectable className="Fragment-Description Fragment-TextBlock">
            {fragment.description.join('\n')}
          </LabelGui>
        ) : null}

        <BoxGui orientation="horizontal" allow_overflow className="Fragment-Columns">
          <WrapperGui allow_overflow className="Fragment-Original BoxItem-expand">
            <LabelGui block selectable className="Fragment-TextBlock">
              <FancyTextGui highlight_crosscode_markup highlight_newlines>
                {fragment.original_text}
              </FancyTextGui>
            </LabelGui>
            <BoxGui orientation="horizontal" className="Fragment-Buttons" align_items="baseline">
              <BoxItemFillerGui />
              <IconButtonGui
                icon="clipboard"
                title="Copy the original text"
                onClick={this.on_copy_original_text}
              />
              <IconButtonGui icon="search" title="Search other fragments with this original text" />
            </BoxGui>
          </WrapperGui>

          <WrapperGui allow_overflow className="BoxItem-expand Fragment-Translations">
            {fragment.translations.map((translation) => (
              <TranslationGui key={translation.ref.obj_id} translation={translation} />
            ))}
            <NewTranslationGui fragment={fragment} />
          </WrapperGui>
        </BoxGui>
      </WrapperGui>
    );
  }
}

export interface FragmentPathGuiProps {
  path: string;
  on_click?: (component_path: string) => void;
}

export interface FragmentPathGuiState {
  clickable: boolean;
}

export class FragmentPathGui extends React.PureComponent<
  FragmentPathGuiProps,
  FragmentPathGuiState
> {
  public static override contextType = AppMainCtx;
  public override context!: AppMainCtx;
  public override state: Readonly<FragmentPathGuiState> = {
    clickable: false,
  };
  private is_mouse_over = false;
  private is_ctrl_pressed = false;

  public override componentDidMount(): void {
    let { app } = this.context;
    app.event_global_key_modifiers_change.on(this.on_keymod_event);
  }

  public override componentWillUnmount(): void {
    let { app } = this.context;
    app.event_global_key_modifiers_change.off(this.on_keymod_event);
  }

  private on_mouse_hover = (_event: React.MouseEvent<HTMLElement>): void => {
    this.is_mouse_over = true;
    this.update_clickable_state();
  };

  private on_mouse_hover_end = (_event: React.MouseEvent<HTMLElement>): void => {
    this.is_mouse_over = false;
    this.update_clickable_state();
  };

  private on_keymod_event = (state: gui.KeyMod): void => {
    this.is_ctrl_pressed = state === gui.KeyMod.Ctrl;
    this.update_clickable_state();
  };

  private update_clickable_state(): void {
    let clickable = this.is_mouse_over && this.is_ctrl_pressed;
    this.setState((state) => (state.clickable !== clickable ? { clickable } : null));
  }

  private on_link_click = (
    component_path: string,
    event: React.MouseEvent<HTMLAnchorElement>,
  ): void => {
    event.preventDefault();
    this.props.on_click?.(component_path);
  };

  public override render(): React.ReactNode {
    let full_path = this.props.path;
    let children: React.ReactNode[] = [full_path];

    if (this.state.clickable) {
      children.length = 0;
      for (let component of utils.split_iter(full_path, '/')) {
        let component_full_path = full_path.slice(0, component.end + 1);
        let component_path = full_path.slice(component.start, component.end + 1);
        children.push(
          // An empty href is required for focus to work on the links.
          <a
            key={component_full_path}
            href=""
            onClick={(event) => this.on_link_click(component_full_path, event)}>
            {component_path}
          </a>,
        );
      }
    }

    // Without a wrapper element, when moving the cursor between path component
    // links, hovering is lost for a moment, so a common element to catch all
    // mouse events is needed.
    return (
      <LabelGui
        selectable
        onMouseEnter={this.on_mouse_hover}
        onMouseMove={this.on_mouse_hover}
        onMouseLeave={this.on_mouse_hover_end}>
        {children}
      </LabelGui>
    );
  }
}

export interface TranslationGuiProps {
  translation: TranslationRoData;
}

export class TranslationGui extends React.Component<TranslationGuiProps, unknown> {
  private on_copy_text = (_event: React.MouseEvent<HTMLButtonElement>): void => {
    nw.Clipboard.get().set(this.props.translation.text);
  };

  public override render(): React.ReactNode {
    let { translation } = this.props;

    return (
      <WrapperGui allow_overflow className="Fragment-Translation">
        <LabelGui block selectable className="Fragment-TextBlock">
          <FancyTextGui highlight_crosscode_markup highlight_newlines>
            {translation.text}
          </FancyTextGui>
        </LabelGui>
        <BoxGui orientation="horizontal" className="Fragment-Buttons" align_items="baseline">
          <LabelGui ellipsis selectable>
            {translation.author_username}
          </LabelGui>
          <LabelGui ellipsis selectable>
            at {format_timestamp(translation.modification_timestamp)}
          </LabelGui>
          <BoxItemFillerGui />
          <IconButtonGui
            icon="clipboard"
            title="Copy the translation text"
            onClick={this.on_copy_text}
          />
          <IconButtonGui icon="pencil-square" title="Edit this translation" />
          <IconButtonGui icon="chat-left-quote" title="Add a comment about this translation" />
          <IconButtonGui icon="trash-fill" title="Delete this translation" />
        </BoxGui>
      </WrapperGui>
    );
  }
}

export interface NewTranslationGuiProps {
  fragment: FragmentRoData;
}

export interface NewTranslationGuiState {
  text: string;
  text_area_height: number;
}

export class NewTranslationGui extends React.Component<
  NewTranslationGuiProps,
  NewTranslationGuiState
> {
  public override state: Readonly<NewTranslationGuiState> = {
    text: '',
    text_area_height: -1,
  };

  private textarea_id: string = utils.new_html_id();

  private on_input = (event: React.FormEvent<HTMLTextAreaElement>): void => {
    let text = event.currentTarget.value;
    let height = -1;
    if (text.length > 0) {
      height = TextAreaGui.compute_text_area_height(event.currentTarget);
    }
    this.setState({ text, text_area_height: height });
  };

  public override render(): React.ReactNode {
    return (
      <WrapperGui allow_overflow className="Fragment-NewTranslation">
        <textarea
          id={this.textarea_id}
          name={this.textarea_id}
          value={this.state.text}
          onInput={this.on_input}
          placeholder="Add new translation..."
          autoComplete="off"
          spellCheck={false}
          rows={2}
          // `ref` must be implemented as an anonymous function here (i.e. not
          // as a bound method) so that it always gets invoked on each render.
          ref={(element: HTMLTextAreaElement | null): void => {
            if (element == null) return;
            let height = this.state.text_area_height;
            if (height > 0) {
              element.style.setProperty('height', `${height}px`, 'important');
              element.style.setProperty('overflow', 'hidden', 'important');
            } else {
              element.style.removeProperty('height');
              element.style.removeProperty('overflow');
            }
          }}
        />
        <BoxGui orientation="horizontal" className="Fragment-Buttons" align_items="baseline">
          <BoxItemFillerGui />
          <IconButtonGui icon="check2" title="Submit" />
        </BoxGui>
      </WrapperGui>
    );
  }
}

export function format_timestamp(timestamp: Date): string {
  let str = '';
  str += timestamp.getFullYear().toString(10).padStart(4, '0');
  str += '-';
  str += timestamp.getMonth().toString(10).padStart(2, '0');
  str += '-';
  str += timestamp.getDate().toString(10).padStart(2, '0');
  str += ' ';
  str += timestamp.getHours().toString(10).padStart(2, '0');
  str += ':';
  str += timestamp.getMinutes().toString(10).padStart(2, '0');
  str += ':';
  str += timestamp.getSeconds().toString(10).padStart(2, '0');
  return str;
}
