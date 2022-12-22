import { PriorityQueue } from 'js-sdsl';

import { BaseAppObject, BaseRenderData } from './app';
import { EventBox } from './events';
import * as utils from './utils';
import { AlgoFn, exactMatchNaive, fuzzyMatchV1, fuzzyMatchV2 } from './vendor/fzf/algo';
import { computeExtendedMatch } from './vendor/fzf/extended';
import { buildPatternForBasicMatch, buildPatternForExtendedMatch } from './vendor/fzf/pattern';
import { Rune, strToRunes } from './vendor/fzf/runes';
import { slab } from './vendor/fzf/slab';

export enum FuzzyMatcherCasing {
  Smart = 'smart-case',
  Sensitive = 'case-sensitive',
  Insensitive = 'case-insensitive',
}

export enum FuzzyMatcherAlgorithm {
  Exact = 'exact',
  V1 = 'v1',
  V2 = 'v2',
}

export class FuzzyItemRoData extends BaseRenderData {
  public constructor(public override readonly ref: FuzzyItem<unknown>) {
    super(ref);
  }
  public readonly text: string = this.ref.text;
  public readonly runes: readonly Rune[] | undefined = this.ref.runes?.slice();
  public readonly match_start: number = this.ref.match_start;
  public readonly match_end: number = this.ref.match_end;
  public readonly match_score: number = this.ref.match_score;
  public readonly match_positions: ReadonlySet<number> = new Set(this.ref.match_positions);
}

export class FuzzyItem<T> extends BaseAppObject<FuzzyItemRoData> {
  public id = utils.new_gui_id();
  public runes: readonly Rune[] | null = null;
  public match_start = -1;
  public match_end = -1;
  public match_score = 0;
  public match_positions = new Set<number>();

  public constructor(public text: string, public data: T) {
    super();
  }

  protected override get_render_data_impl(): FuzzyItemRoData {
    return new FuzzyItemRoData(this);
  }

  public set_text(text: string): void {
    this.text = text;
    this.runes = null;
  }

  public get_runes(): readonly Rune[] {
    let { runes } = this;
    if (runes == null) {
      runes = strToRunes(this.text.normalize());
      this.runes = runes;
    }
    return runes;
  }

  public unset_match(): void {
    this.match_start = -1;
    this.match_end = -1;
    this.match_score = 0;
    this.match_positions.clear();
  }

  public has_match(): boolean {
    return this.match_start >= 0;
  }
}

export interface FuzzyQueryOptions {
  case_sensitivity: FuzzyMatcherCasing;
  unicode_normalize: boolean;
  fuzzy_algorithm: FuzzyMatcherAlgorithm;
  forward_matching: boolean;
  extended_matching: boolean;
  millis_per_tick_budget: number;
}

export class FuzzyMatcher<T> {
  private task_token: utils.CancellationToken | null = null;
  private readonly items_queue = new utils.Queue<FuzzyItem<T>>();
  // Other implementations of a heap/priority queue:
  // <https://github.com/datastructures-js/heap/blob/v4.1.2/src/heap.js>
  // <https://github.com/mgechev/javascript-algorithms/blob/213636fc58768364fd60ae959c61e1b136a5e85e/src/data-structures/heap.js>
  // <https://github.com/js-sdsl/js-sdsl/blob/v4.2.0/src/container/OtherContainer/PriorityQueue.ts>
  // <https://github.com/samvv/scl.js/blob/a07d6f6993c03a7ca1e7e5d153b87ace9d9880af/src/Heap.ts>
  // <https://github.com/montagejs/collections/blob/v5.1.13/heap.js>
  private readonly sorted_items_heap = new PriorityQueue<FuzzyItem<T>>(
    [],
    this.compare_items.bind(this),
    /* copy */ false,
  );
  private readonly sorted_items_cache: Array<FuzzyItem<T>> = [];

  public readonly event_start = new EventBox();
  public readonly event_matching_tick = new EventBox();
  public readonly event_sorting_tick = new EventBox();
  public readonly event_completed = new EventBox();
  public readonly event_cancelled = new EventBox();

  public constructor() {
    this.reset_state();
  }

  public reset_state(): void {
    this.stop_task();
    this.items_queue.clear();
    this.clear_sorted_items();
  }

  public queued_items_count(): number {
    return this.items_queue.size();
  }

  public clear_queued_items(): void {
    this.items_queue.clear();
  }

  public enqueue_items(new_items: ReadonlyArray<FuzzyItem<T>>): void {
    this.items_queue.enqueue_many(new_items);
  }

  public enqueue_item(item: FuzzyItem<T>): void {
    this.items_queue.enqueue(item);
  }

  public is_task_in_progress(): boolean {
    return this.task_token != null && !this.task_token.is_cancelled;
  }

  public stop_task(): void {
    this.task_token?.cancel();
    this.task_token = null;
  }

  public async start_task(query: string, opts: Partial<FuzzyQueryOptions>): Promise<void> {
    this.stop_task();
    let token = new utils.CancellationToken();
    this.task_token = token;

    try {
      await utils.wait_next_tick(token);

      this.event_start.fire();
      if (token.is_cancelled) return;

      let all_opts: FuzzyQueryOptions = {
        case_sensitivity: FuzzyMatcherCasing.Smart,
        unicode_normalize: false,
        fuzzy_algorithm: FuzzyMatcherAlgorithm.V2,
        forward_matching: true,
        extended_matching: false,
        millis_per_tick_budget: 8,
        ...opts,
      };

      let algo_fn_map = new Map<FuzzyMatcherAlgorithm, AlgoFn>([
        [FuzzyMatcherAlgorithm.Exact, exactMatchNaive],
        [FuzzyMatcherAlgorithm.V1, fuzzyMatchV1],
        [FuzzyMatcherAlgorithm.V2, fuzzyMatchV2],
      ]);
      let algo_fn = algo_fn_map.get(all_opts.fuzzy_algorithm);
      if (algo_fn == null) {
        throw new Error(`Unknown FuzzyMatcherAlgorithm: ${all_opts.fuzzy_algorithm}`);
      }

      let do_match = all_opts.extended_matching
        ? this.extended_match_impl(query, all_opts, algo_fn)
        : this.basic_match_impl(query, all_opts, algo_fn);

      while (!this.items_queue.is_empty()) {
        let start_time = performance.now();
        do {
          let item = this.items_queue.dequeue();
          if (item == null) break;
          let matched = do_match(item);
          if (matched) {
            this.sorted_items_heap.push(item);
          }
        } while (performance.now() - start_time < all_opts.millis_per_tick_budget);
        this.event_matching_tick.fire();
        await utils.wait_next_tick(token);
      }

      while (!this.sorted_items_heap.empty()) {
        let start_time = performance.now();
        do {
          let item = this.sorted_items_heap.pop();
          if (item == null) break;
          this.sorted_items_cache.push(item);
        } while (performance.now() - start_time < all_opts.millis_per_tick_budget);
        this.event_sorting_tick.fire();
        await utils.wait_next_tick(token);
      }

      this.event_completed.fire();
    } catch (error) {
      if (!(error instanceof utils.CancellationError)) {
        throw error;
      }
    } finally {
      if (token.is_cancelled) {
        this.event_cancelled.fire();
      }
      if (this.task_token === token) {
        this.task_token = null;
      }
    }
  }

  private basic_match_impl(
    query: string,
    opts: FuzzyQueryOptions,
    algo_fn: AlgoFn,
  ): (item: FuzzyItem<T>) => boolean {
    let pattern = buildPatternForBasicMatch(query, opts.case_sensitivity, opts.unicode_normalize);
    let query_runes = pattern.queryRunes;
    let case_sensitive = pattern.caseSensitive;

    return (item) => {
      let item_runes = item.get_runes();
      item.unset_match();
      item.mark_changed();

      if (query_runes.length > item_runes.length) {
        return false;
      }
      let [match, positions] = algo_fn(
        case_sensitive,
        opts.unicode_normalize,
        opts.forward_matching,
        item_runes as Rune[],
        query_runes,
        true,
        slab,
      );
      if (match.start < 0) {
        return false;
      }

      item.match_start = match.start;
      item.match_end = match.end;
      item.match_score = match.score;
      if (positions == null) {
        positions = new Set();
        for (let pos = match.start; pos < match.end; pos++) {
          positions.add(pos);
        }
      }
      item.match_positions = positions;
      return true;
    };
  }

  private extended_match_impl(
    query: string,
    opts: FuzzyQueryOptions,
    algo_fn: AlgoFn,
  ): (item: FuzzyItem<T>) => boolean {
    let pattern = buildPatternForExtendedMatch(
      opts.fuzzy_algorithm !== FuzzyMatcherAlgorithm.Exact,
      opts.case_sensitivity,
      opts.unicode_normalize,
      query,
    );

    return (item) => {
      let item_runes = item.get_runes();
      item.unset_match();
      item.mark_changed();

      let match = computeExtendedMatch(
        item_runes as Rune[],
        pattern,
        algo_fn,
        opts.forward_matching,
      );
      if (match.offsets.length !== pattern.termSets.length) {
        return false;
      }

      item.match_score = match.totalScore;
      item.match_start = -1;
      item.match_end = -1;
      if (match.allPos.size > 0) {
        item.match_start = Math.min(...match.allPos);
        item.match_end = Math.max(...match.allPos) + 1;
      }
      item.match_positions = match.allPos;
      return true;
    };
  }

  public compare_items(a: FuzzyItem<T>, b: FuzzyItem<T>): number {
    if (a.match_score !== b.match_score) {
      return b.match_score - a.match_score;
    }
    if (a.runes!.length !== b.runes!.length) {
      return a.runes!.length - b.runes!.length;
    }
    if (a.match_start !== b.match_start) {
      return a.match_start - b.match_start;
    }
    return a.id - b.id;
  }

  public clear_sorted_items(): void {
    this.sorted_items_heap.clear();
    this.sorted_items_cache.length = 0;
  }

  public sorted_items_count(): number {
    return this.sorted_items_heap.size() + this.sorted_items_cache.length;
  }

  public get_sorted(index: number): FuzzyItem<T> | null {
    if (index !== (index | 0) || !(0 <= index && index < this.sorted_items_count())) {
      return null;
    }
    for (let i = this.sorted_items_cache.length; i <= index; i++) {
      this.sorted_items_cache.push(this.sorted_items_heap.pop()!);
    }
    return this.sorted_items_cache[index];
  }

  public get_sorted_items_list(): Array<FuzzyItem<T>> {
    while (true) {
      let item = this.sorted_items_heap.pop();
      if (item == null) break;
      this.sorted_items_cache.push(item);
    }
    return this.sorted_items_cache.slice();
  }
}
