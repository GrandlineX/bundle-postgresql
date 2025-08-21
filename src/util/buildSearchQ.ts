import {
  CoreEntity,
  EntityConfig,
  isQInterfaceSearchAdvanced,
  isQInterfaceSearchAdvancedArr,
  QInterfaceSearch,
  QInterfaceSearchAdvanced,
} from '@grandlinex/core';
import { convertSpecialFields } from './converter.js';

class ParamCounter {
  private count;

  constructor() {
    this.count = 1;
  }

  next() {
    return `$${this.count++}`;
  }
}

function aFilter<E extends CoreEntity>(
  key: string,
  s: QInterfaceSearchAdvanced<QInterfaceSearch<E>, keyof E>,
  count: ParamCounter,
): string {
  switch (s.mode) {
    case 'equals':
      return `${key} = ${count.next()}`;
    case 'not':
      return `${key} != ${count.next()}`;
    case 'like':
      return `${key} like '%' || ${count.next()} || '%'`;
    case 'smallerThan':
      return `${key} < ${count.next()}`;
    case 'greaterThan':
      return `${key} > ${count.next()}`;
    default:
      throw new Error(`Unknown mode: ${s.mode}`);
  }
}

export default function buildSearchQ<E extends CoreEntity>(
  config: EntityConfig<E>,
  search: QInterfaceSearch<E>,
  param: any[],
  searchQ: string,
) {
  let temp = searchQ;
  const keys: (keyof E)[] = Object.keys(search) as (keyof E)[];
  if (keys.length > 0) {
    const filter: string[] = [];
    const count = new ParamCounter();
    for (const key of keys) {
      const s: QInterfaceSearch<E>[keyof E] = search[key];
      const meta = config.meta.get(key);
      if (!meta) {
        throw new Error('Missing meta');
      }
      if (isQInterfaceSearchAdvanced(s)) {
        filter.push(aFilter(String(key), s, count));
        convertSpecialFields(meta, s.value, param);
      } else if (isQInterfaceSearchAdvancedArr(s)) {
        filter.push(
          ...s.map((e) => {
            const ax = aFilter(String(key), e, count);
            convertSpecialFields(meta, e.value, param);
            return ax;
          }),
        );
      } else {
        filter.push(`${String(key)} = ${count.next()}`);
        convertSpecialFields(meta, search[key], param);
      }
    }
    if (filter.length > 0) {
      temp = ` WHERE ${filter.join(' AND ')}`;
    }
  }
  return temp;
}
