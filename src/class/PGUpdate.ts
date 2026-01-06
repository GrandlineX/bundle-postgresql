import { CoreDBUpdate, RawQuery, XUtil } from '@grandlinex/core';
import PGCon from './PGCon.js';

/**
 * Abstract helper class for performing database schema updates on PostgreSQL.
 *
 * Extends {@link CoreDBUpdate} specialized for the {@link PGCon} connection type.
 *
 * @abstract
 */
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
   * Adds a new column to a database table corresponding to the provided class name.
   *
   * @param {string} className - The name of the class whose table will be altered. The table name is derived by converting the class name from camelCase to snake_case.
   * @param {string} columName - The name of the new column to add.
   * @param {string} type - The SQL data type of the new column (e.g., `"INTEGER"`, `"VARCHAR(255)"`).
   * @param {boolean} notNull - Whether the new column should be defined as NOT NULL.
   * @param {string} [defaultValue] - Optional default value for the new column. If supplied, the default is applied unless `deleteDefault` is true.
   * @param {boolean} [deleteDefault] - When true and a default value is supplied, the default is dropped after the column is added.
   * @returns {Promise<boolean>} A promise that resolves to `true` if all SQL statements executed successfully, otherwise `false`.
   */
  protected async alterTableAddColumn(
    className: string,
    columName: string,
    type: string,
    notNull: boolean,
    defaultValue?: string,
    deleteDefault?: boolean,
  ): Promise<boolean> {
    const db = this.getDb();
    const tableName = XUtil.camelToSnakeCase(className);
    const query: RawQuery[] = [];

    if (notNull && defaultValue !== undefined) {
      query.push({
        exec: `ALTER TABLE ${db.schemaName}.${tableName} ADD ${columName} ${type} NOT NULL DEFAULT ${defaultValue};`,
        param: [],
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
   * Deletes a column from the database table that corresponds to the given class name.
   *
   * @param {string} className The name of the class representing the table. The method converts this name from camelCase to snake_case to derive the actual table name.
   * @param {string} columName The name of the column to be removed from the table.
   * @returns {Promise<boolean>} A promise that resolves to `true` when the column has been successfully dropped from all executed queries; otherwise it resolves to `false`.
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
