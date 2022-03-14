import { DataType } from '@grandlinex/core';

export default function resolveDBType(dType: DataType) {
  switch (dType) {
    case 'int':
      return 'INT';
    case 'double':
    case 'float':
      return 'REAL';
    case 'blob':
      return 'BYTEA';
    case 'string':
    case 'text':
    case 'uuid':
      return 'TEXT';
    case 'boolean':
      return 'BOOLEAN';
    case 'date':
      return 'TIMESTAMP';
    case 'json':
      return 'JSON';
    default:
      throw Error('TypeNotSupported');
  }
}
