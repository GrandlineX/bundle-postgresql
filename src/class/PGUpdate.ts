import { CoreDBUpdate, RawQuery, XUtil } from '@grandlinex/core';
import PGCon from './PGCon.js';

export default abstract class PGUpdate extends CoreDBUpdate<PGCon> {
  /**
   * Initialize a new table in the database.
   * This method is used to create a new table in the database.
   * @param className
   */
  protected initNewTable(className: string): Promise<boolean> {
    return this.getDb().getEntityWrapper(className)!.init();
  }

  /**
   * Alter a table to add a new column.
   * @param className
   * @param columName
   * @param type
   * @param notNull
   * @param defaultValue
   * @param deleteDefault
   * @protected
   */
  protected async alterTableAddColumn(
    className: string,
    columName: string,
    type: string,
    notNull: boolean,
    defaultValue?: any,
    deleteDefault?: boolean,
  ): Promise<boolean> {
    const db = this.getDb();
    const tableName = XUtil.camelToSnakeCase(className);
    const query: RawQuery[] = [];

    if (notNull && defaultValue !== undefined) {
      query.push({
        exec: `ALTER TABLE ${db.schemaName}.${tableName} ADD ${columName} ${type} NOT NULL DEFAULT $1;`,
        param: [defaultValue],
      });
    } else if (notNull) {
      query.push({
        exec: `ALTER TABLE ${db.schemaName}.${tableName} ADD ${columName} ${type} NOT NULL;`,
        param: [],
      });
    } else {
      query.push({
        exec: `ALTER TABLE ${db.schemaName}.${tableName} ADD ${columName} ${type};`,
        param: [],
      });
    }

    if (defaultValue !== undefined && deleteDefault) {
      query.push({
        exec: `ALTER TABLE ${db.schemaName}.${tableName} ALTER COLUMN ${columName} DROP DEFAULT ;`,
        param: [],
      });
    }
    return (await db.execScripts(query)).every((e) => e !== null);
  }

  /**
   * Alter a table to delete a column.
   * This method is used to remove a column from an existing table in the database.
   * @param className
   * @param columName
   * @protected
   */
  protected async alterTableDeleteColumn(
    className: string,
    columName: string,
  ): Promise<boolean> {
    const db = this.getDb();
    const tableName = XUtil.camelToSnakeCase(className);
    const query: RawQuery[] = [];
    query.push({
      exec: `ALTER TABLE ${db.schemaName}.${tableName} DROP COLUMN ${columName};`,
      param: [],
    });
    return (await db.execScripts(query)).every((e) => e !== null);
  }
}
