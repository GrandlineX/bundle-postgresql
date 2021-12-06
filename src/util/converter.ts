import {
  ColumnProps,
  CoreEntity,
  EntityConfig,
  EUpDateProperties,
} from '@grandlinex/core';

function convertSpecialFields<E>(
  meta: ColumnProps,
  clone: any,
  key: keyof E,
  params: any[]
) {
  if (meta.dataType === 'json') {
    params.push(JSON.stringify(clone[key]));
  } else {
    params.push(clone[key]);
  }
}

export function objToTable<E extends CoreEntity>(
  config: EntityConfig<E>,
  entity: E | EUpDateProperties<E>,
  update?: boolean
): [(keyof E)[], string[], unknown[]] {
  const clone: any = entity;
  const keysOrigal = Object.keys(entity) as (keyof E)[];
  const keys: (keyof E)[] = [];
  const params: any[] = [];
  const values: string[] = [];
  let pCount = 1;

  keysOrigal.forEach((key) => {
    const meta = config.meta.get(key);
    if (!meta) {
      throw new Error('No col meta');
    }
    if (meta.primaryKey) {
      return;
    }
    convertSpecialFields<E>(meta, clone, key, params);
    if (update) {
      values.push(`${key}=$${pCount}`);
    } else {
      values.push(`$${pCount}`);
    }
    pCount += 1;

    keys.push(key);
  });

  if (values.length === params.length && params.length === keys.length) {
    return [keys, values, params];
  }
  throw new Error('Invalid output length');
}

export function rowToObj<E extends CoreEntity>(
  config: EntityConfig<E>,
  row: any
): E {
  return row;
}

export function tableToObj<E extends CoreEntity>(
  config: EntityConfig<E>,
  table: any[]
): E[] {
  return table.map((row) => {
    return rowToObj(config, row);
  });
}
