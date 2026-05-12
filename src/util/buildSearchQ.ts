import {
  ColumnProps,
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
  meta: ColumnProps,
  param: any[],
): string {
  switch (s.mode) {
    case 'equals':
      if ((s as any).value === null) {
        return `${key} IS NULL`;
      }
      convertSpecialFields(meta, (s as any).value, param);
      return `${key} = ${count.next()}`;
    case 'not':
      if ((s as any).value === null) {
        return `${key} IS NOT NULL`;
      }
      convertSpecialFields(meta, (s as any).value, param);
      return `${key} != ${count.next()}`;
    case 'like':
      convertSpecialFields(meta, (s as any).value, param);
      return `LOWER(${key}) like '%' || LOWER(${count.next()}) || '%'`;
    case 'startsWith':
      convertSpecialFields(meta, (s as any).value, param);
      return `LOWER(${key}) like LOWER(${count.next()}) || '%'`;
    case 'endsWith':
      convertSpecialFields(meta, (s as any).value, param);
      return `LOWER(${key}) like '%' || LOWER(${count.next()})`;
    case 'smallerThan':
      convertSpecialFields(meta, (s as any).value, param);
      return `${key} < ${count.next()}`;
    case 'greaterThan':
      convertSpecialFields(meta, (s as any).value, param);
      return `${key} > ${count.next()}`;
    case 'in': {
      const vals = (s as any).value as any[];
      vals.forEach((v) => convertSpecialFields(meta, v, param));
      return `${key} IN (${vals.map(() => count.next()).join(', ')})`;
    }
    case 'notIn': {
      const vals = (s as any).value as any[];
      vals.forEach((v) => convertSpecialFields(meta, v, param));
      return `${key} NOT IN (${vals.map(() => count.next()).join(', ')})`;
    }
    case 'between': {
      const [min, max] = (s as any).value as [any, any];
      convertSpecialFields(meta, min, param);
      convertSpecialFields(meta, max, param);
      return `${key} BETWEEN ${count.next()} AND ${count.next()}`;
    }
    case 'isNull':
      return `${key} IS NULL`;
    case 'isNotNull':
      return `${key} IS NOT NULL`;
    default:
      throw new Error(`Unknown mode: ${(s as any).mode}`);
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
        filter.push(aFilter(String(key), s, count, meta, param));
      } else if (isQInterfaceSearchAdvancedArr(s)) {
        filter.push(
          ...s.map((e) => aFilter(String(key), e, count, meta, param)),
        );
      } else if (search[key] === null) {
        filter.push(`${String(key)} IS NULL`);
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