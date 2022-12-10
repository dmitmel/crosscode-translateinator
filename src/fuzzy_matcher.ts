import * as utils from './utils';
import { AlgoFn, exactMatchNaive, fuzzyMatchV1, fuzzyMatchV2 } from './vendor/fzf/algo';
import { computeExtendedMatch } from './vendor/fzf/extended';
import { SyncOptionsTuple } from './vendor/fzf/finders';
import { basicMatch, extendedMatch } from './vendor/fzf/matchers';
import { buildPatternForBasicMatch, buildPatternForExtendedMatch } from './vendor/fzf/pattern';
import { Rune, strToRunes } from './vendor/fzf/runes';
import { slab } from './vendor/fzf/slab';
import { byLengthAsc, byStartAsc } from './vendor/fzf/tiebreakers';
import { FzfResultItem, SyncOptions } from './vendor/fzf/types';

export { FzfResultItem };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DEFAULT_OPTIONS: SyncOptions<any> = {
  limit: Infinity,
  selector: (v) => v,
  casing: 'smart-case',
  normalize: true,
  fuzzy: 'v2',
  tiebreakers: [byLengthAsc, byStartAsc],
  sort: true,
  forward: true,
  match: basicMatch,
};

export class FuzzyMatcher<T> {
  public readonly runes_list: Rune[][];
  public readonly items: readonly T[];
  public readonly opts: SyncOptions<T>;
  public readonly algo_fn: AlgoFn;

  public constructor(list: readonly T[], ...options_tuple: SyncOptionsTuple<T>) {
    this.opts = { ...DEFAULT_OPTIONS, ...options_tuple[0] };
    this.items = list;
    this.runes_list = list.map((item) => strToRunes(this.opts.selector(item).normalize()));
    this.algo_fn = exactMatchNaive;
    switch (this.opts.fuzzy) {
      case 'v2':
        this.algo_fn = fuzzyMatchV2;
        break;
      case 'v1':
        this.algo_fn = fuzzyMatchV1;
        break;
    }
  }

  public find(query: string): Array<FzfResultItem<T>> {
    if (query.length === 0 || this.items.length === 0) {
      return this.items.slice(0, this.opts.limit).map((item) => {
        return { item, start: -1, end: -1, score: 0, positions: new Set() };
      });
    }

    query = query.normalize();

    let iter: (idx: number) => FzfResultItem<T> | null;
    if (this.opts.match === basicMatch) {
      iter = this.get_basic_match_iter(query);
    } else if (this.opts.match === extendedMatch) {
      iter = this.get_extended_match_iter(query);
    } else {
      throw new Error('Unsupported matching function');
    }

    let score_map = new Map<number, Array<FzfResultItem<T>>>();
    for (let i = 0, len = this.runes_list.length; i < len; i++) {
      let match = iter(i);
      if (match == null) continue;
      // If we aren't sorting, we'll put all items in the same score bucket
      // (we've chosen zero score for it below). This will result in us getting
      // items in the same order in which we've send them in the list.
      let score_key = this.opts.sort ? match.score : 0;
      let score_list = score_map.get(score_key);
      if (score_list != null) {
        score_list.push(match);
      } else {
        score_map.set(score_key, [match]);
      }
    }
    let result = this.get_result_from_score_map(score_map);

    if (this.opts.sort) {
      let { selector } = this.opts;

      result.sort((a, b) => {
        if (a.score === b.score) {
          for (let tiebreaker of this.opts.tiebreakers) {
            let diff = tiebreaker(a, b, selector);
            if (diff !== 0) {
              return diff;
            }
          }
        }
        return 0;
      });
    }

    if (Number.isFinite(this.opts.limit)) {
      result.splice(this.opts.limit);
    }

    return result;
  }

  private get_result_from_score_map<T>(
    score_map: Map<number, Array<FzfResultItem<T>>>,
  ): Array<FzfResultItem<T>> {
    let scores_in_desc = Array.from(score_map.keys()).sort((a, b) => b - a);

    let result: Array<FzfResultItem<T>> = [];

    for (let score of scores_in_desc) {
      result = result.concat(score_map.get(score)!);
      if (result.length >= this.opts.limit) {
        break;
      }
    }

    return result;
  }

  private get_basic_match_iter(query: string): (idx: number) => FzfResultItem<T> | null {
    let pattern = buildPatternForBasicMatch(query, this.opts.casing, this.opts.normalize);
    let query_runes = pattern.queryRunes;
    let case_sensitive = pattern.caseSensitive;

    return (idx: number) => {
      let item_runes = this.runes_list[idx];
      if (query_runes.length > item_runes.length) return null;

      let [match, positions] = this.algo_fn(
        case_sensitive,
        this.opts.normalize,
        this.opts.forward,
        item_runes,
        query_runes,
        true,
        slab,
      );
      if (match.start === -1) return null;

      // We don't get positions array back for exact match, so we'll fill it by ourselves.
      if (this.opts.fuzzy === false) {
        positions = new Set();
        for (let position = match.start; position < match.end; ++position) {
          positions.add(position);
        }
      }

      return {
        item: this.items[idx],
        ...match,
        positions: positions ?? new Set(),
      };
    };
  }

  private get_extended_match_iter(query: string): (idx: number) => FzfResultItem<T> | null {
    let pattern = buildPatternForExtendedMatch(
      Boolean(this.opts.fuzzy),
      this.opts.casing,
      this.opts.normalize,
      query,
    );

    return (idx: number) => {
      let runes = this.runes_list[idx];
      let match = computeExtendedMatch(runes, pattern, this.algo_fn, this.opts.forward);
      if (match.offsets.length !== pattern.termSets.length) return null;

      let sidx = -1;
      let eidx = -1;
      if (match.allPos.size > 0) {
        sidx = Math.min(...match.allPos);
        eidx = Math.max(...match.allPos) + 1;
      }

      return {
        score: match.totalScore,
        item: this.items[idx],
        positions: match.allPos,
        start: sidx,
        end: eidx,
      };
    };
  }
}
