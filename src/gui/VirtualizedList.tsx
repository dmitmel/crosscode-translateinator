// A component that implements virtual scrolling - this is a technique of
// displaying very large lists without actually rendering the whole list to the
// DOM. Since rendering lots of components, most of which will be off-screen
// anyway, is slow and consumes a lot of memory, virtual scrolling works by
// only showing a narrow slice of items which currently fit in the viewport
// (plus a few additional off-screen items - my code calls this "overscan").
// For that a big scrollable container is created, whose height is estimated
// from the number of items in the list. When this container is scrolled by the
// user, the presently visible slice is re-calculated: the items that are no
// longer visible are unloaded, and new ones are loaded instead. All other
// invisible items are replaced, "virtualized", with two large empty blocks
// equal to the size of all those items - before and after the viewport.
//
// My implementation is largely influenced by code from these libraries:
// <https://github.com/TanStack/virtual/blob/v2.10.4/src/index.js>
// <https://github.com/bvaughn/react-window/blob/1.8.6/src/createListComponent.js>
// <https://github.com/bvaughn/react-window/blob/1.8.6/src/FixedSizeList.js>
// <https://github.com/bvaughn/react-window/blob/1.8.6/src/VariableSizeList.js>
// <https://github.com/angular/components/blob/14.2.1/src/cdk-experimental/scrolling/auto-size-virtual-scroll.ts>
// <https://github.com/angular/components/blob/14.2.1/src/cdk/scrolling/virtual-scroll-viewport.ts>
// <https://github.com/angular/components/blob/14.2.1/src/cdk/scrolling/scrollable.ts>
// <https://github.com/angular/components/blob/14.2.1/src/cdk/scrolling/virtual-for-of.ts>
// <https://github.com/tangbc/vue-virtual-scroll-list/blob/v2.3.4/src/virtual.js>
// <https://github.com/tangbc/vue-virtual-scroll-list/blob/v2.3.4/src/index.js>
// <https://github.com/tangbc/vue-virtual-scroll-list/blob/v2.3.4/src/item.js>
// (Naturally, the first two projects were the most useful to me as they are
// made for React.)
//
// However, mine is different in some aspects and contains a few improvements.
// First of all, some of those libraries simply weren't made for React, so if
// the code had some useful techniques or features that I wanted to have and
// use (and the implementation in the Angular components library is a pretty
// advanced one), I would have to rewrite it in any case.
//
// Regardless, the major feature that I needed most is the ability for the
// component to work without knowing the exact sizes of items prior to
// rendering them, and then dynamically readjust itself after obtaining real
// measurements of the items. React-window can't do this at all, it relies on
// having a function that can tell beforehand the height of any item at a given
// index (thus it wasn't suitable at all for the fragment list, which was the
// actual motivation for writing my own virtualized list component);
// react-virtual can, but it uses hooks and I'm not (at least not in this
// application). Furthermore, my implementation can automatically estimate the
// average size of items and use that value for items for which no recorded
// size exists (because they haven't been rendered yet), and, as far as I can
// tell, only the Angular component library can do that, and the implementation
// itself is considered experimental. The list itself is also more flexible: if
// an item is bigger than its predicted size, it won't overlap some other item
// because the list doesn't rely on `absolute` positioning.
//
// Although the improvements do come with some challenges. Here is the list of
// some known bugs and other problems:
//
// 1. TODO: In the mode when the average item size is computed dynamically, in
//    response to every change of the average size the scroll position also has
//    to be adjusted after increases/decreases of the size of blank blocks for
//    the virtualized items. This effectively means assigning `scrollTop` to
//    some "corrected" value. The problem here is that when the user scrolls by
//    pressing the Home/End/PageUp/PageDown keys, the smooth scroll transition
//    is interrupted by the scroll correction. So to go to the beginning or end
//    of the list the user has to keep pressing Home or End to get past the
//    interruptions. A solution could be to debounce the changes in the average
//    size.
// 2. TODO: A related problem is that when the `overscan` parameter is set to
//    zero, scrolling upwards when the sizes of the items above aren't known,
//    the list will jump slightly because of the changes between the estimated
//    size of items and the actual size after rendering.
// 3. TODO: This is more of a general note rather than a concrete problem, but
//    the implementation should use keys instead of indexes for recording the
//    sizes of items. The list items may shift around, but their sizes will
//    almost certainly follow the keys rather than stay at the same indexes.
//    Also this makes the functions for registering item HTML elements simpler.

import * as React from 'react';

import * as utils from '../utils';
import { WrapperGui } from './Box';

export interface VirtListItemFnProps<T> {
  list: VirtualizedListGui<T>;
  index: number;
  data: T;
}

export interface VirtListContainerFnProps<T> {
  list: VirtualizedListGui<T>;
  inner_ref: React.RefCallback<HTMLElement>;
  className?: string;
  style?: React.CSSProperties;
  on_scroll: React.UIEventHandler<HTMLElement>;
  children: React.ReactNode;
}

interface VirtualizedListGuiInternalProps<T> {
  className?: string;
  style?: React.CSSProperties;
  item_count: number;
  item_data: T;
  // Unlike react-window I use render props because that allows the user of the
  // component to select which props they want to pass to the item components,
  // which avoids problems (missing and/or excessive re-renders) when the item
  // component is a pure one.
  render_container: (props: VirtListContainerFnProps<T>) => React.ReactNode;
  // NOTE: This function must also set the `key` on the components it creates!
  render_item: (props: VirtListItemFnProps<T>) => React.ReactNode;
  item_size: number;
  // TODO: This is an optimization, but has a low priority. The fixed size mode
  // would require bypassing the item_measurements array for most calculations,
  // but we still need to keep it for average item size estimation and if some
  // item is accidentally not of the same size (e.g. due to overflow).
  fixed_size_items: boolean;
  estimate_average_item_size: boolean;
  // TODO: Increase the overscan if the user is scrolling fast.
  overscan_count: number;
  last_page_behavior: 'normal' | 'one_last_item' | 'full_blank';
  on_items_rendered?: (list: VirtualizedListGui<T>) => void;
  on_scroll?: (list: VirtualizedListGui<T>, event: React.UIEvent<HTMLElement>) => void;
}

// This will create a type where all props that are in `defaultProps` are
// marked as optional, while my code can continue relying on the internal props
// type where everything is non-optional.
export type VirtualizedListGuiProps<T> = JSX.LibraryManagedAttributes<
  typeof VirtualizedListGui,
  VirtualizedListGuiInternalProps<T>
>;

export interface VirtualizedListGuiState {
  average_item_size: number;
  slice_start: number;
  slice_end: number;
  visible_slice_start: number;
  visible_slice_end: number;
  current_index: number;
  offset_start: number;
  offset_end: number;
  total_size: number;
  viewport_size: number;
  viewport_cross_size: number;
  slice_total_size: number;
}

export interface ItemMeasurement {
  offset: number;
  size: number;
  // A negative value means that no data is available because the item has not
  // been rendered yet. In that case `size` will be set to the average size -
  // this makes all calculations much more straightforward.
  real_size: number;
}

export interface VirtualizedListGuiSnapshot {
  scroll_offset: number;
}

export enum VirtListScrollAlign {
  Start = 'start',
  End = 'end',
  Center = 'center',
  Auto = 'auto',
  Smart = 'smart',
}

export class VirtualizedListGui<T> extends React.Component<
  VirtualizedListGuiInternalProps<T>,
  VirtualizedListGuiState,
  VirtualizedListGuiSnapshot
> {
  public item_measurements: ItemMeasurement[] = [];
  // For cumulative average calculation.
  private average_item_size_accum = 0;
  private average_item_size_samples = 0;

  public override state: Readonly<VirtualizedListGuiState> = {
    average_item_size: this.calc_average_item_size(),
    slice_start: 0,
    slice_end: 0,
    visible_slice_start: 0,
    visible_slice_end: 0,
    current_index: -1,
    offset_start: 0,
    offset_end: 0,
    total_size: 0,
    viewport_size: 0,
    viewport_cross_size: 0,
    slice_total_size: 0,
  };

  public static readonly defaultProps: Pick<
    VirtualizedListGuiInternalProps<unknown>,
    | 'render_container'
    | 'overscan_count'
    | 'fixed_size_items'
    | 'last_page_behavior'
    | 'estimate_average_item_size'
  > = {
    render_container: VirtListContainerGui,
    overscan_count: 2,
    fixed_size_items: false,
    last_page_behavior: 'normal',
    estimate_average_item_size: false,
  };

  public list_elem: HTMLElement | null = null;
  private resize_observer: ResizeObserver;
  private item_elements_map = new Map<number, HTMLElement>();
  private reverse_item_elements_map = new WeakMap<Element, number>();

  private scheduled_scroll_hook: (() => void) | null = null;
  private scroll_correction_delta = 0;

  public constructor(props: Readonly<VirtualizedListGuiInternalProps<T>>) {
    super(props);
    this.resize_observer = new ResizeObserver(this.resize_observer_callback);
  }

  public on_item_mounted(index: number, element: HTMLElement): void {
    this.item_elements_map.set(index, element);
    this.reverse_item_elements_map.set(element, index);
    this.resize_observer.observe(element, { box: 'border-box' });
  }

  public on_item_updated(prev_index: number, next_index: number, element: HTMLElement): void {
    if (prev_index !== next_index) {
      this.on_item_unmounted(prev_index, element);
      this.on_item_mounted(next_index, element);
    }
  }

  public on_item_unmounted(index: number, element: HTMLElement): void {
    if (this.item_elements_map.get(index) === element) {
      this.item_elements_map.delete(index);
    }
    if (this.reverse_item_elements_map.get(element) === index) {
      this.reverse_item_elements_map.delete(element);
      this.resize_observer.unobserve(element);
    }
  }

  public get_item_element(index: number): HTMLElement | undefined {
    return this.item_elements_map.get(index);
  }

  private list_elem_ref = (new_list_elem: HTMLElement | null): void => {
    this.list_elem = new_list_elem;
  };

  public get_scroll_offset(): number {
    return this.list_elem!.scrollTop;
  }

  public set_scroll_offset(offset: number): void {
    this.list_elem!.scrollTop = offset;
  }

  public get_viewport_size(): number {
    return this.list_elem!.clientHeight;
  }

  public get_viewport_cross_size(): number {
    return this.list_elem!.clientWidth;
  }

  public get_scroll_size(): number {
    return this.list_elem!.scrollHeight;
  }

  public get_max_scroll_offset(): number {
    return this.list_elem!.scrollHeight - this.list_elem!.clientHeight;
  }

  public clamp_scroll_offset(offset: number): number {
    return utils.clamp(offset, 0, this.get_max_scroll_offset());
  }

  public override componentDidMount(): void {
    this.resize_observer.observe(this.list_elem!, { box: 'border-box' });
    this.on_items_rendered(null, null, null);
  }

  public override componentWillUnmount(): void {
    this.resize_observer.disconnect();
    // Deallocate the stuff.
    this.item_measurements.length = 0;
  }

  public override componentDidUpdate(
    prev_props: Readonly<VirtualizedListGuiInternalProps<T>>,
    prev_state: Readonly<VirtualizedListGuiState>,
    snapshot: VirtualizedListGuiSnapshot,
  ): void {
    this.on_items_rendered(prev_props, prev_state, snapshot);
  }

  public override getSnapshotBeforeUpdate(): VirtualizedListGuiSnapshot {
    return {
      scroll_offset: this.clamp_scroll_offset(this.get_scroll_offset()),
    };
  }

  private on_items_rendered(
    _prev_props: Readonly<VirtualizedListGuiInternalProps<T>> | null,
    _prev_state: Readonly<VirtualizedListGuiState> | null,
    snapshot: VirtualizedListGuiSnapshot | null,
  ): void {
    this.extend_or_shrink_item_measurements();
    let should_update_again = this.update({ snapshot });
    if (!should_update_again) {
      this.scheduled_scroll_hook?.();
      this.props.on_items_rendered?.(this);
    }
  }

  private extend_or_shrink_item_measurements(): void {
    let list = this.item_measurements;
    let { item_count } = this.props;
    if (list.length === item_count) return;
    let prev_count = list.length;
    for (let i = item_count; i < prev_count; i++) {
      let { real_size } = list[i];
      if (real_size < 0) continue;
      this.average_item_size_samples -= 1;
      this.average_item_size_accum -= real_size;
    }
    let size = this.state.average_item_size;
    let offset = 0;
    if (prev_count > 0) {
      let measurement = list[prev_count - 1];
      offset += measurement.offset + measurement.size;
    }
    list.length = item_count;
    for (let i = prev_count; i < item_count; i++) {
      list[i] = { offset, size, real_size: -1 };
      offset += size;
    }
  }

  private measure_items(slice_start: number, slice_end: number): boolean {
    let { item_measurements } = this;
    let any_item_size_changed = false;
    for (let i = slice_start; i < slice_end; i++) {
      let item_elem = this.get_item_element(i)!;
      let measurement = item_measurements[i];
      let new_size = item_elem.offsetHeight;
      let old_size = measurement.real_size;
      if (old_size < 0) {
        measurement.real_size = new_size;
        this.average_item_size_accum += new_size;
        this.average_item_size_samples += 1;
        any_item_size_changed = true;
      } else if (old_size !== new_size) {
        measurement.real_size = new_size;
        this.average_item_size_accum += new_size - old_size;
        any_item_size_changed = true;
      }
    }
    return any_item_size_changed;
  }

  private reset_measured_item_sizes(): void {
    let { item_measurements } = this;
    for (let i = 0, len = item_measurements.length; i < len; i++) {
      item_measurements[i].real_size = -1;
    }
    this.average_item_size_accum = 0;
    this.average_item_size_samples = 0;
  }

  private recalc_item_offsets(average_item_size: number): void {
    let { item_measurements } = this;
    let offset = 0;
    for (let i = 0, len = item_measurements.length; i < len; i++) {
      let measurement = item_measurements[i];
      let size = measurement.real_size >= 0 ? measurement.real_size : average_item_size;
      measurement.size = size;
      measurement.offset = offset;
      offset += size;
    }
  }

  private calc_average_item_size(): number {
    if (this.props.estimate_average_item_size && this.average_item_size_samples > 0) {
      return Math.round(this.average_item_size_accum / this.average_item_size_samples);
    } else {
      return this.props.item_size;
    }
  }

  public get_item_offset_at_index(index: number): number {
    let { item_measurements } = this;
    let item_count = item_measurements.length;
    index = utils.clamp(index, 0, item_count);
    if (index < item_count) {
      return item_measurements[index].offset;
    } else if (item_count > 0) {
      let measurement = item_measurements[item_count - 1];
      return measurement.offset + measurement.size;
    } else {
      return 0;
    }
  }

  public update(
    options?: {
      snapshot?: VirtualizedListGuiSnapshot | null;
      reset_item_sizes?: boolean | null;
    } | null,
  ): boolean {
    let { props, state } = this;
    let { item_count } = props;
    let { snapshot, reset_item_sizes } = options ?? {};

    let slice_end = utils.clamp(state.slice_end, 0, item_count);
    let slice_start = utils.clamp(state.slice_start, 0, slice_end);
    let visible_slice_end = utils.clamp(state.visible_slice_end, 0, item_count);
    let visible_slice_start = utils.clamp(state.visible_slice_start, 0, visible_slice_end);

    if (snapshot != null) {
      this.apply_scroll_offset_correction(snapshot.scroll_offset);
    }

    let scroll_delta = 0;
    scroll_delta -= this.get_item_offset_at_index(visible_slice_start);

    if (reset_item_sizes) {
      this.reset_measured_item_sizes();
    }
    // TODO: Don't measure items in on_scroll
    let any_item_size_changed = this.measure_items(slice_start, slice_end);
    let average_item_size = this.calc_average_item_size();
    if (any_item_size_changed) {
      this.recalc_item_offsets(average_item_size);
    }

    scroll_delta += this.get_item_offset_at_index(visible_slice_start);
    this.scroll_correction_delta += scroll_delta;

    let viewport_size = this.get_viewport_size();
    let viewport_cross_size = this.get_viewport_cross_size();
    // Clamp is for protection against elastic scrolling in some browsers,
    // otherwise from the perspective of the code the scroll offset falls
    // outside the container.
    let scroll_offset = this.clamp_scroll_offset(this.get_scroll_offset());
    let fixed_scroll_offset = scroll_offset + this.scroll_correction_delta;

    if (item_count > 0) {
      // TODO: This can be done smarter. Realistically, most of the time the
      // scroll offset will change by just a little bit and be somewhere close
      // to the currently rendered slice.
      const find_item_by_offset = (target_offset: number, is_last: boolean): number => {
        let result_index = utils.binary_search(
          0,
          item_count,
          (index: number): number => {
            let measurement = this.item_measurements[index];
            if (target_offset < measurement.offset) {
              return 1;
            } else if (target_offset < measurement.offset + measurement.size) {
              return 0;
            } else {
              return -1;
            }
          },
          { find_very_first: !is_last, find_very_last: is_last, find_strictly_equal: false },
        );
        utils.assert(result_index != null);
        return result_index;
      };

      visible_slice_start = find_item_by_offset(fixed_scroll_offset, false);
      visible_slice_end = find_item_by_offset(fixed_scroll_offset + viewport_size, true) + 1;

      visible_slice_end = utils.clamp(visible_slice_end, 0, item_count);
      visible_slice_start = utils.clamp(visible_slice_start, 0, visible_slice_end);
    }

    let current_index = -1;
    let visible_slice_len = visible_slice_end - visible_slice_start;
    if (visible_slice_len === 1) {
      current_index = visible_slice_start;
    } else if (visible_slice_len >= 2) {
      let measurement = this.item_measurements[visible_slice_start];
      if (fixed_scroll_offset <= measurement.offset + measurement.size / 2) {
        current_index = visible_slice_start;
      } else {
        current_index = visible_slice_start + 1;
      }
    }

    let { overscan_count } = props;
    slice_end = utils.clamp(visible_slice_end + overscan_count, 0, item_count);
    slice_start = utils.clamp(visible_slice_start - overscan_count, 0, slice_end);

    let total_size = this.get_item_offset_at_index(item_count);
    if (item_count > 0) {
      if (props.last_page_behavior === 'one_last_item') {
        let last_item_measurement = this.item_measurements[item_count - 1];
        total_size += Math.max(0, viewport_size - last_item_measurement.size);
      } else if (props.last_page_behavior === 'full_blank') {
        total_size += viewport_size;
      }
    }

    let offset_start = this.get_item_offset_at_index(slice_start);
    let slice_end_offset = this.get_item_offset_at_index(slice_end);
    let slice_total_size = slice_end_offset - offset_start;
    let offset_end = total_size - slice_end_offset;

    if (
      state.average_item_size !== average_item_size ||
      state.slice_start !== slice_start ||
      state.slice_end !== slice_end ||
      state.visible_slice_start !== visible_slice_start ||
      state.visible_slice_end !== visible_slice_end ||
      state.current_index !== current_index ||
      state.offset_start !== offset_start ||
      state.offset_end !== offset_end ||
      state.total_size !== total_size ||
      state.viewport_size !== viewport_size ||
      state.viewport_cross_size !== viewport_cross_size ||
      state.slice_total_size !== slice_total_size
    ) {
      let state_update: Readonly<VirtualizedListGuiState> = {
        average_item_size,
        slice_start,
        slice_end,
        visible_slice_start,
        visible_slice_end,
        current_index,
        offset_start,
        offset_end,
        total_size,
        viewport_size,
        viewport_cross_size,
        slice_total_size,
      };
      this.setState(state_update);
      return true;
    } else {
      this.apply_scroll_offset_correction(scroll_offset);
      return false;
    }
  }

  private apply_scroll_offset_correction(current_offset: number): void {
    let delta = this.scroll_correction_delta;
    this.scroll_correction_delta = 0;
    let fixed_offset = this.clamp_scroll_offset(current_offset + delta);
    if (this.get_scroll_offset() !== fixed_offset) {
      this.set_scroll_offset(fixed_offset);
    }
  }

  private align_scroll_offset(offset: number, size: number, align: VirtListScrollAlign): number {
    // <https://github.com/bvaughn/react-window/blob/1.8.6/src/FixedSizeList.js#L17-L79>
    // <https://github.com/TanStack/virtual/blob/v2.10.4/src/index.js#L206-L261>
    let scroll_offset = this.get_scroll_offset();
    let viewport_size = this.get_viewport_size();
    switch (this.normalize_smart_align(offset, size, align)) {
      case VirtListScrollAlign.Start:
        return offset;
      case VirtListScrollAlign.End:
        return offset - (viewport_size - size);
      case VirtListScrollAlign.Center:
        // In the case when size is greater than viewport_size we want the
        // scroll offset to be at the start of the block we are aligning to.
        // Then the subtraction result becomes negative, and taking max with
        // zero eliminates that term from the expression.
        return Math.round(offset - Math.max(0, viewport_size - size) / 2);
      case VirtListScrollAlign.Auto:
        // What the expression here accomplishes is basically: when
        // scroll_offset is within the block we are aligning to, it is returned
        // unchanged, and so the "aligned offset" actually is the current
        // scroll_offset, but when it falls outside of the boundaries of the
        // block, we clamp it to its nearest edge.
        return utils.clamp(scroll_offset, offset - Math.max(0, viewport_size - size), offset);
      default:
        return offset;
    }
  }

  private normalize_smart_align(
    offset: number,
    size: number,
    align: VirtListScrollAlign,
  ): VirtListScrollAlign {
    if (align !== VirtListScrollAlign.Smart) return align;
    let scroll_offset = this.get_scroll_offset();
    let viewport_size = this.get_viewport_size();
    if (offset - viewport_size <= scroll_offset && scroll_offset < offset + size) {
      // The item is in the viewport, or at the very least partially visible.
      return VirtListScrollAlign.Auto;
    } else {
      return VirtListScrollAlign.Center;
    }
  }

  public scroll_to_offset(target_offset: number, align?: VirtListScrollAlign | null): void {
    align ??= VirtListScrollAlign.Start;
    this.set_scroll_offset(this.align_scroll_offset(target_offset, 0, align));
  }

  public scroll_to_item(target_index: number, align?: VirtListScrollAlign | null): void {
    this.scheduled_scroll_hook = null;
    align ??= VirtListScrollAlign.Smart;
    target_index = utils.clamp(target_index, 0, this.props.item_count);

    let item_elem = this.get_item_element(target_index);
    let item_offset: number;
    let item_size: number;
    if (item_elem != null) {
      item_offset = item_elem.offsetTop;
      // `offsetTop` is calculated relative to the offsetParent, not to the
      // parent element, we must take that into account when necessary.
      // <https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent>
      let parent_elem = item_elem.parentElement;
      let offset_parent = item_elem.offsetParent;
      if (offset_parent !== parent_elem && offset_parent != null && parent_elem != null) {
        item_offset -= parent_elem.offsetTop;
      }
      item_size = item_elem.offsetHeight;
    } else {
      let measurement = this.item_measurements[target_index];
      item_offset = measurement.offset;
      item_size = measurement.size;
    }

    align = this.normalize_smart_align(item_offset, item_size, align);
    // TODO: We can't rely on the implicit call to `on_scroll` by setting
    // `scrollTop` because if the scroll position doesn't change, the `scroll`
    // event handler is not invoked.
    let target_offset = this.align_scroll_offset(item_offset, item_size, align);
    if (this.get_scroll_offset() !== target_offset) {
      this.scheduled_scroll_hook = () => {
        this.scheduled_scroll_hook = null;
        this.scroll_to_item(target_index, align);
      };
      // This will implicitly call the on_scroll handler.
      this.set_scroll_offset(target_offset);
    }
  }

  private on_scroll = (event: React.UIEvent<HTMLElement>): void => {
    this.update();
    this.props.on_scroll?.(this, event);
  };

  private resize_observer_callback = (entries: ResizeObserverEntry[]): void => {
    let should_update = false;
    let should_reset = false;
    for (let entry of entries) {
      if (entry.target === this.list_elem) {
        should_update ||= this.state.viewport_size !== this.get_viewport_size();
        should_update ||= this.state.viewport_cross_size !== this.get_viewport_cross_size();
        should_reset = true;
      }
      let item_index = this.reverse_item_elements_map.get(entry.target);
      if (item_index != null) {
        let item_elem = this.get_item_element(item_index)!;
        should_update ||= this.item_measurements[item_index].size !== item_elem.offsetHeight;
      }
    }
    if (should_update) {
      this.update({ reset_item_sizes: should_reset });
    }
  };

  public override render(): React.ReactNode {
    let { props, state } = this;

    let { item_count } = props;
    let slice_end = utils.clamp(state.slice_end, 0, item_count);
    let slice_start = utils.clamp(state.slice_start, 0, slice_end);

    let items: React.ReactNode[] = [];
    for (let i = slice_start; i < slice_end; i++) {
      items.push(props.render_item({ list: this, index: i, data: props.item_data }));
    }

    return this.props.render_container({
      list: this,
      inner_ref: this.list_elem_ref,
      className: props.className,
      style: props.style,
      on_scroll: this.on_scroll,
      children: items,
    });
  }
}

export function VirtListContainerGui<T>(props: VirtListContainerFnProps<T>): React.ReactElement {
  let { list } = props;
  return (
    <WrapperGui
      ref={props.inner_ref}
      scroll
      className={props.className}
      style={props.style}
      onScroll={props.on_scroll}>
      <div style={{ height: list.state.offset_start }} />
      {props.children}
      <div style={{ height: list.state.offset_end }} />
    </WrapperGui>
  );
}
