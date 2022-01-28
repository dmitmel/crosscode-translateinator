/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undefined */

import memoizeOne from 'memoize-one';
import * as preact from 'preact';
import { PureComponent } from 'preact/compat';

// Animation frame based implementation of setTimeout.
// Inspired by Joe Lambert, https://gist.github.com/joelambert/1002116#file-requesttimeout-js

const hasNativePerformanceNow =
  typeof performance === 'object' && typeof performance.now === 'function';

const now = hasNativePerformanceNow ? () => performance.now() : () => Date.now();

export interface TimeoutID {
  id: number;
}

export function cancelTimeout(timeoutID: TimeoutID): void {
  cancelAnimationFrame(timeoutID.id);
}

export function requestTimeout(callback: () => void, delay: number): TimeoutID {
  const start = now();

  function tick(): void {
    if (now() - start >= delay) {
      callback();
    } else {
      timeoutID.id = requestAnimationFrame(tick);
    }
  }

  const timeoutID: TimeoutID = {
    id: requestAnimationFrame(tick),
  };

  return timeoutID;
}

export type ScrollToAlign = 'auto' | 'smart' | 'center' | 'start' | 'end';

type itemSize = number | ((index: number) => number);

export interface RenderComponentProps<T> {
  data: T;
  index: number;
  isScrolling?: boolean;
  style: preact.JSX.CSSProperties;
}
export type RenderComponent<T> = preact.ComponentType<RenderComponentProps<T>>;

type ScrollDirection = 'forward' | 'backward';

type onItemsRenderedCallback = (event: {
  overscanStartIndex: number;
  overscanStopIndex: number;
  visibleStartIndex: number;
  visibleStopIndex: number;
}) => void;
type onScrollCallback = (event: {
  scrollDirection: ScrollDirection;
  scrollOffset: number;
  scrollUpdateWasRequested: boolean;
}) => void;

type ScrollEvent = preact.JSX.TargetedUIEvent<Element>;
interface ItemStyleCache {
  [index: number]: preact.JSX.CSSProperties;
}

interface OuterProps {
  children?: preact.ComponentChildren;
  ref?: preact.Ref<any>;
  className: string | void;
  onScroll: (event: ScrollEvent) => void;
  style: preact.JSX.CSSProperties;
}

interface InnerProps {
  children?: preact.ComponentChildren;
  ref?: preact.Ref<any>;
  style: preact.JSX.CSSProperties;
}

export interface Props<T> {
  children: RenderComponent<T>;
  className?: string;
  height: number;
  initialScrollOffset?: number;
  innerRef?: preact.Ref<any>;
  innerElementType?: string | preact.ComponentType<InnerProps>;
  itemCount: number;
  itemData: T;
  itemKey?: (index: number, data: T) => preact.Key;
  itemSize: itemSize;
  onItemsRendered?: onItemsRenderedCallback;
  onScroll?: onScrollCallback;
  outerRef?: preact.Ref<any>;
  outerElementType?: string | preact.ComponentType<OuterProps>;
  overscanCount?: number;
  style?: preact.JSX.CSSProperties;
  useIsScrolling?: boolean;
  width: number | string;
}

interface State {
  isScrolling: boolean;
  scrollDirection: ScrollDirection;
  scrollOffset: number;
  scrollUpdateWasRequested: boolean;
}

const IS_SCROLLING_DEBOUNCE_INTERVAL = 150;

const defaultItemKey = (index: number, _data: unknown): preact.Key => index;

export abstract class BaseList<T> extends PureComponent<Props<T>, State> {
  private _outerRef: Element | null = null;
  private _resetIsScrollingTimeoutId: TimeoutID | null = null;

  public static override defaultProps = {
    itemData: undefined,
    overscanCount: 2,
    useIsScrolling: false,
    itemKey: defaultItemKey,
  };

  public override state: State = {
    isScrolling: false,
    scrollDirection: 'forward',
    scrollOffset:
      typeof this.props.initialScrollOffset === 'number' ? this.props.initialScrollOffset : 0,
    scrollUpdateWasRequested: false,
  };

  protected abstract getItemOffset(index: number): number;
  protected abstract getItemSize(index: number): number;
  protected abstract getEstimatedTotalSize(): number;
  protected abstract getOffsetForIndexAndAlignment(
    index: number,
    align: ScrollToAlign,
    scrollOffset: number,
  ): number;
  protected abstract getStartIndexForOffset(offset: number): number;
  protected abstract getStopIndexForStartIndex(startIndex: number, scrollOffset: number): number;
  protected abstract shouldResetStyleCacheOnItemSizeChange: boolean;

  public scrollTo(scrollOffset: number): void {
    scrollOffset = Math.max(0, scrollOffset);

    this.setState((prevState) => {
      if (prevState.scrollOffset === scrollOffset) {
        return null;
      }
      return {
        scrollDirection: prevState.scrollOffset < scrollOffset ? 'forward' : 'backward',
        scrollOffset,
        scrollUpdateWasRequested: true,
      };
    }, this._resetIsScrollingDebounced);
  }

  public scrollToItem(index: number, align: ScrollToAlign = 'auto'): void {
    const { itemCount } = this.props;
    const { scrollOffset } = this.state;

    index = Math.max(0, Math.min(index, itemCount - 1));

    this.scrollTo(this.getOffsetForIndexAndAlignment(index, align, scrollOffset));
  }

  public override componentDidMount(): void {
    const { initialScrollOffset } = this.props;

    if (typeof initialScrollOffset === 'number' && this._outerRef != null) {
      const outerRef = this._outerRef;
      outerRef.scrollTop = initialScrollOffset;
    }

    this._callPropsCallbacks();
  }

  public override componentDidUpdate(): void {
    const { scrollOffset, scrollUpdateWasRequested } = this.state;

    if (scrollUpdateWasRequested && this._outerRef != null) {
      const outerRef = this._outerRef;

      outerRef.scrollTop = scrollOffset;
    }

    this._callPropsCallbacks();
  }

  public override componentWillUnmount(): void {
    if (this._resetIsScrollingTimeoutId != null) {
      cancelTimeout(this._resetIsScrollingTimeoutId);
    }
  }

  public override render(): preact.VNode {
    const {
      children,
      className,
      height,
      innerRef,
      innerElementType,
      itemCount,
      itemData,
      itemKey,
      outerElementType,
      style,
      useIsScrolling,
      width,
    } = this.props;
    const { isScrolling } = this.state;

    const [startIndex, stopIndex] = this._getRangeToRender();

    const items = [];
    if (itemCount > 0) {
      for (let index = startIndex; index <= stopIndex; index++) {
        items.push(
          preact.createElement(children, {
            data: itemData,
            key: itemKey!(index, itemData),
            index,
            isScrolling: useIsScrolling ? isScrolling : undefined,
            style: this._getItemStyle(index),
          }),
        );
      }
    }

    // Read this value AFTER items have been created,
    // So their actual sizes (if variable) are taken into consideration.
    const estimatedTotalSize = this.getEstimatedTotalSize();

    let createElement2 = preact.createElement as <T>(
      type: string | preact.ComponentType<T>,
      props: T,
      ...children: preact.ComponentChildren[]
    ) => preact.VNode<any>;

    return createElement2(
      outerElementType ?? 'div',
      {
        className,
        onScroll: this._onScrollVertical,
        ref: this._outerRefSetter,
        style: {
          position: 'relative',
          height,
          width,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          willChange: 'transform',
          ...style,
        },
      },
      createElement2(innerElementType ?? 'div', {
        children: items,
        ref: innerRef,
        style: {
          height: estimatedTotalSize,
          pointerEvents: isScrolling ? 'none' : undefined,
          width: '100%',
        },
      }),
    );
  }

  private _callOnItemsRendered: (
    overscanStartIndex: number,
    overscanStopIndex: number,
    visibleStartIndex: number,
    visibleStopIndex: number,
  ) => void = memoizeOne(
    (
      overscanStartIndex: number,
      overscanStopIndex: number,
      visibleStartIndex: number,
      visibleStopIndex: number,
    ) => {
      this.props.onItemsRendered!({
        overscanStartIndex,
        overscanStopIndex,
        visibleStartIndex,
        visibleStopIndex,
      });
    },
  );

  private _callOnScroll: (
    scrollDirection: ScrollDirection,
    scrollOffset: number,
    scrollUpdateWasRequested: boolean,
  ) => void = memoizeOne(
    (scrollDirection: ScrollDirection, scrollOffset: number, scrollUpdateWasRequested: boolean) => {
      this.props.onScroll!({
        scrollDirection,
        scrollOffset,
        scrollUpdateWasRequested,
      });
    },
  );

  private _callPropsCallbacks(): void {
    if (typeof this.props.onItemsRendered === 'function') {
      const { itemCount } = this.props;
      if (itemCount > 0) {
        const [overscanStartIndex, overscanStopIndex, visibleStartIndex, visibleStopIndex] =
          this._getRangeToRender();
        this._callOnItemsRendered(
          overscanStartIndex,
          overscanStopIndex,
          visibleStartIndex,
          visibleStopIndex,
        );
      }
    }

    if (typeof this.props.onScroll === 'function') {
      const { scrollDirection, scrollOffset, scrollUpdateWasRequested } = this.state;
      this._callOnScroll(scrollDirection, scrollOffset, scrollUpdateWasRequested);
    }
  }

  // Lazily create and cache item styles while scrolling,
  // So that pure component sCU will prevent re-renders.
  // We maintain this cache, and pass a style prop rather than index,
  // So that List can clear cached styles and force item re-render if necessary.
  private _getItemStyle = (index: number): preact.JSX.CSSProperties => {
    const { itemSize } = this.props;

    const itemStyleCache = this._getItemStyleCache(
      this.shouldResetStyleCacheOnItemSizeChange && itemSize,
    );

    let style: preact.JSX.CSSProperties;
    if (itemStyleCache.hasOwnProperty(index)) {
      style = itemStyleCache[index];
    } else {
      const offset = this.getItemOffset(index);
      const size = this.getItemSize(index);

      style = {
        position: 'absolute',
        left: 0,
        right: undefined,
        top: offset,
        height: size,
        width: '100%',
      };
      itemStyleCache[index] = style;
    }

    return style;
  };

  private _getItemStyleCache: (_: unknown) => ItemStyleCache = memoizeOne((_: unknown) => ({}));

  private _getRangeToRender(): [number, number, number, number] {
    const { itemCount, overscanCount } = this.props;
    const { isScrolling, scrollDirection, scrollOffset } = this.state;

    if (itemCount === 0) {
      return [0, 0, 0, 0];
    }

    const startIndex = this.getStartIndexForOffset(scrollOffset);
    const stopIndex = this.getStopIndexForStartIndex(startIndex, scrollOffset);

    // Overscan by one item in each direction so that tab/focus works.
    // If there isn't at least one extra item, tab loops back around.
    const overscanBackward =
      !isScrolling || scrollDirection === 'backward' ? Math.max(1, overscanCount!) : 1;
    const overscanForward =
      !isScrolling || scrollDirection === 'forward' ? Math.max(1, overscanCount!) : 1;

    return [
      Math.max(0, startIndex - overscanBackward),
      Math.max(0, Math.min(itemCount - 1, stopIndex + overscanForward)),
      startIndex,
      stopIndex,
    ];
  }

  private _onScrollVertical = (event: ScrollEvent): void => {
    const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
    this.setState((prevState) => {
      if (prevState.scrollOffset === scrollTop) {
        // Scroll position may have been updated by cDM/cDU,
        // In which case we don't need to trigger another render,
        // And we don't want to update state.isScrolling.
        return null;
      }

      // Prevent Safari's elastic scrolling from causing visual shaking when scrolling past bounds.
      const scrollOffset = Math.max(0, Math.min(scrollTop, scrollHeight - clientHeight));

      return {
        isScrolling: true,
        scrollDirection: prevState.scrollOffset < scrollOffset ? 'forward' : 'backward',
        scrollOffset,
        scrollUpdateWasRequested: false,
      };
    }, this._resetIsScrollingDebounced);
  };

  private _outerRefSetter = (ref: Element | null): void => {
    const { outerRef } = this.props;

    this._outerRef = ref;

    if (typeof outerRef === 'function') {
      outerRef(ref);
    } else if (
      outerRef != null &&
      typeof outerRef === 'object' &&
      outerRef.hasOwnProperty('current')
    ) {
      (outerRef as { current: Element | null }).current = ref;
    }
  };

  private _resetIsScrollingDebounced = (): void => {
    if (this._resetIsScrollingTimeoutId != null) {
      cancelTimeout(this._resetIsScrollingTimeoutId);
    }

    this._resetIsScrollingTimeoutId = requestTimeout(
      this._resetIsScrolling,
      IS_SCROLLING_DEBOUNCE_INTERVAL,
    );
  };

  private _resetIsScrolling = (): void => {
    this._resetIsScrollingTimeoutId = null;

    this.setState({ isScrolling: false }, () => {
      // Clear style cache after state update has been committed.
      // This way we don't break pure sCU for items that don't use isScrolling param.
      this._getItemStyleCache(-1);
    });
  };
}

// NOTE: I considered further wrapping individual items with a pure ListItem component.
// This would avoid ever calling the render function for the same index more than once,
// But it would also add the overhead of a lot of components/fibers.
// I assume people already do this (render function returning a class component),
// So my doing it would just unnecessarily double the wrappers.

export class FixedSizeList<T> extends BaseList<T> {
  protected override getItemOffset(index: number): number {
    return index * (this.props.itemSize as number);
  }

  protected override getItemSize(index: number): number {
    return this.props.itemSize as number;
  }

  protected override getEstimatedTotalSize(): number {
    return (this.props.itemSize as number) * this.props.itemCount;
  }

  protected override getOffsetForIndexAndAlignment(
    index: number,
    align: ScrollToAlign,
    scrollOffset: number,
  ): number {
    const { height, itemCount, itemSize } = this.props;

    const size = height;
    const lastItemOffset = Math.max(0, itemCount * (itemSize as number) - size);
    const maxOffset = Math.min(lastItemOffset, index * (itemSize as number));
    const minOffset = Math.max(0, index * (itemSize as number) - size + (itemSize as number));

    if (align === 'smart') {
      if (scrollOffset >= minOffset - size && scrollOffset <= maxOffset + size) {
        align = 'auto';
      } else {
        align = 'center';
      }
    }

    switch (align) {
      case 'start':
        return maxOffset;
      case 'end':
        return minOffset;
      case 'center': {
        // "Centered" offset is usually the average of the min and max.
        // But near the edges of the list, this doesn't hold true.
        const middleOffset = Math.round(minOffset + (maxOffset - minOffset) / 2);
        if (middleOffset < Math.ceil(size / 2)) {
          return 0; // near the beginning
        } else if (middleOffset > lastItemOffset + Math.floor(size / 2)) {
          return lastItemOffset; // near the end
        } else {
          return middleOffset;
        }
      }
      case 'auto':
      default:
        if (scrollOffset >= minOffset && scrollOffset <= maxOffset) {
          return scrollOffset;
        } else if (scrollOffset < minOffset) {
          return minOffset;
        } else {
          return maxOffset;
        }
    }
  }

  protected override getStartIndexForOffset(offset: number): number {
    const { itemCount, itemSize } = this.props;
    return Math.max(0, Math.min(itemCount - 1, Math.floor(offset / (itemSize as number))));
  }

  protected override getStopIndexForStartIndex(startIndex: number, scrollOffset: number): number {
    const { height, itemCount, itemSize } = this.props;
    const offset = startIndex * (itemSize as number);
    const size = height;
    const numVisibleItems = Math.ceil((size + scrollOffset - offset) / (itemSize as number));
    return Math.max(
      0,
      Math.min(
        itemCount - 1,
        startIndex + numVisibleItems - 1, // -1 is because stop index is inclusive
      ),
    );
  }

  protected shouldResetStyleCacheOnItemSizeChange = true;
}
