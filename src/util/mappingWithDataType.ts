import { ColumnProps, CoreEntity } from '@grandlinex/core';
import resolveDBType from './resolveDBType';

export default function mappingWithDataType<E extends CoreEntity>(
  meta: ColumnProps,
  out: string[],
  key: keyof E,
  schemaName: string
): void {
  if (!meta.dataType) {
    throw new Error('DataType not set');
  }
  if (meta.dataType === 'serial') {
    out.push(`${key} SERIAL NOT NUL`);
  } else {
    const canBeNull = `${meta.canBeNull ? '' : ' NOT NULL'}`;
    const unique = `${meta.unique ? ' UNIQUE' : ''}`;
    let foreignKey: string;
    if (meta.foreignKey) {
      foreignKey = ` REFERENCES ${schemaName}.${meta.foreignKey.relation}(${meta.foreignKey.key})`;
    } else {
      foreignKey = '';
    }
    const dbType = resolveDBType(meta.dataType);
    out.push(`${key} ${dbType}${foreignKey}${canBeNull}${unique}`);
  }
}
