import {
  ConfigType,
  CoreDBCon,
  CoreEntity,
  EntityConfig,
  EOrderBy,
  EProperties,
  EUpDateProperties,
  getColumnMeta,
  ICoreKernelModule,
  IDataBase,
} from '@grandlinex/core';
import { RawQuery } from '@grandlinex/core/dist/lib';

import { Client, QueryResult } from 'pg';
import {
  buildSearchQ,
  mappingWithDataType,
  objToTable,
  rowToObj,
  tableToObj,
} from '../util';

type PGDBType = Client;

export default abstract class PGCon
  extends CoreDBCon<PGDBType, QueryResult | null>
  implements IDataBase<PGDBType, QueryResult | null>
{
  db: PGDBType | null;

  protected constructor(
    module: ICoreKernelModule<any, any, any, any, any>,
    dbversion: string
  ) {
    super(dbversion, module.getName(), module);

    this.db = null;
  }

  async createEntity<E extends CoreEntity>(
    config: EntityConfig<E>,
    entity: EProperties<E>
  ): Promise<E> {
    const clone: any = entity;
    const [keys, values, params] = objToTable(config, entity);

    const result = await this.execScripts([
      {
        exec: `INSERT INTO ${this.schemaName}.${config.className}(${keys.join(
          ', '
        )})
                       VALUES (${values.join(', ')})
                       returning e_id`,
        param: params,
      },
    ]);
    if (!result[0] || !result[0].rows[0]) {
      throw this.lError('Cant create entity');
    }
    clone.e_id = result[0].rows[0].e_id;
    return clone;
  }

  async updateEntity<E extends CoreEntity>(
    config: EntityConfig<E>,
    e_id: number,
    entity: EUpDateProperties<E>
  ): Promise<boolean> {
    const [, values, params] = objToTable(config, entity, true);
    const result = await this.execScripts([
      {
        exec: `UPDATE ${this.schemaName}.${config.className}
                           SET ${values.join(', ')}
                           WHERE e_id = ${e_id};`,
        param: params,
      },
    ]);

    return !!result[0];
  }

  async getEntityById<E extends CoreEntity>(
    config: EntityConfig<E>,
    id: number
  ): Promise<E | null> {
    const query = await this.execScripts([
      {
        exec: `SELECT *
                       FROM ${this.schemaName}.${config.className}
                       WHERE e_id = ${id};`,
        param: [],
      },
    ]);

    const res = query[0]?.rows[0];
    if (res) {
      return rowToObj<E>(config, res);
    }
    return null;
  }

  async deleteEntityById(className: string, id: number): Promise<boolean> {
    const query = await this.execScripts([
      {
        exec: `DELETE
                       FROM ${this.schemaName}.${className}
                       WHERE e_id = ${id};`,
        param: [],
      },
    ]);
    return query[0] !== null;
  }

  async findEntity<E extends CoreEntity>(
    config: EntityConfig<E>,
    search: { [P in keyof E]?: E[P] | undefined }
  ): Promise<E | null> {
    let searchQ = '';
    const param: any[] = [];

    searchQ = buildSearchQ<E>(search, param, searchQ);

    const query = await this.execScripts([
      {
        exec: `SELECT *
                       FROM ${this.schemaName}.${config.className} ${searchQ};`,
        param,
      },
    ]);

    const res = query[0]?.rows[0];
    if (res) {
      return rowToObj<E>(config, res);
    }
    return null;
  }

  async getEntityList<E extends CoreEntity>(
    config: EntityConfig<E>,
    limit?: number,
    search?: {
      [P in keyof E]: E[P];
    },
    order?: EOrderBy<E>
  ): Promise<E[]> {
    if (limit === 0) {
      return [];
    }
    let searchQ = '';
    const orderBy: string[] = [];
    let orderByQ = '';
    const range = limit ? ` LIMIT ${limit}` : '';
    const param: any[] = [];
    if (search) {
      searchQ = buildSearchQ<E>(search, param, searchQ);
    }
    if (order && order.length > 0) {
      order.forEach((val) => {
        orderBy.push(`${val.key} ${val.order}`);
      });
      orderByQ = `ORDER BY ${orderBy.join(',\n')}`;
    }
    const query = await this.execScripts([
      {
        exec: `SELECT *
                       FROM ${this.schemaName}.${config.className} 
                            ${searchQ}
                            ${orderByQ}
                            ${range};`,
        param,
      },
    ]);

    const res = query[0]?.rows;
    if (res) {
      return tableToObj<E>(config, res);
    }
    return [];
  }

  async initEntity<E extends CoreEntity>(
    className: string,
    entity: E
  ): Promise<boolean> {
    await this.execScripts([
      {
        exec: `CREATE TABLE ${this.schemaName}.${className}
                       (
                           ${this.transformEntityKeys<E>(entity)}
                       );`,
        param: [],
      },
    ]);
    return true;
  }

  transformEntityKeys<E extends CoreEntity>(entity: E): string {
    const keys: (keyof E)[] = Object.keys(entity) as (keyof E)[];
    const out: string[] = [];

    keys.forEach((key) => {
      const meta = getColumnMeta(entity, key);
      if (meta?.dataType) {
        mappingWithDataType(meta, out, key, this.schemaName);
      } else if (key === 'e_id') {
        out.push(`e_id SERIAL PRIMARY KEY`);
      } else {
        const type = typeof entity[key];
        switch (type) {
          case 'bigint':
          case 'number':
            out.push(`${key} INT`);
            break;
          case 'string':
            out.push(`${key} TEXT`);
            break;
          default:
            break;
        }
      }
    });

    return out.join(',\n');
  }

  async removeConfig(key: string): Promise<void> {
    try {
      const query = await this.execScripts([
        {
          exec: `DELETE
                           FROM ${this.schemaName}.config
                           WHERE c_key = $1;`,
          param: [key],
        },
      ]);
      this.log(query);
      if (query.length !== 1) {
        this.error('invalid result');
      }
    } catch (e) {
      this.error(e);
    }
  }

  abstract initNewDB(): Promise<void>;

  async connect(): Promise<boolean> {
    const store = this.getKernel().getConfigStore();
    const path = store.get('DBPATH');
    const port = store.get('DBPORT');
    const pw = store.get('POSTGRES_PASSWORD');
    const user = store.get('POSTGRES_USER');
    if (!path || !port || !pw || !user) {
      this.error('NO PG CONFIG FOUND');
      return false;
    }
    let client;
    try {
      client = new Client({
        user,
        host: path,
        port: Number(port),
        password: pw,
      });
      await client.connect();
      this.db = client;
    } catch (e) {
      this.error(e);
      process.exit(3);

      return false;
    }
    this.log('DB Connected');
    const query = await client.query(
      `SELECT count(schema_name)
             FROM information_schema.schemata
             where schema_name = '${this.schemaName}';`
    );
    if (query.rows.length !== 1) {
      process.exit(3);
    }
    if (query.rows[0].count === '0') {
      this.log('CREATENEW');
      await this.execScripts([
        { exec: `CREATE SCHEMA ${this.schemaName};`, param: [] },
        {
          exec: `CREATE TABLE ${this.schemaName}.config
                           (
                               c_key   TEXT NOT NULL,
                               c_value TEXT,
                               PRIMARY KEY (c_key)
                           );`,
          param: [],
        },
        {
          exec: `INSERT INTO ${this.schemaName}.config (c_key, c_value)
                           VALUES ('dbversion', '${this.dbVersion}');`,
          param: [],
        },
      ]);
      this.setNew(true);
      return true;
    }
    return query.rows[0].count === '1';
  }

  getRawDBObject(): PGDBType | null {
    return this.db;
  }

  async configExist(key: string): Promise<boolean> {
    const query = await this.execScripts([
      {
        exec: `SELECT *
                       FROM ${this.schemaName}.config
                       WHERE c_key = '${key}'`,
        param: [],
      },
    ]);
    return query.length === 1 && query[0]?.rows.length === 1;
  }

  async setConfig(key: string, value: string): Promise<boolean> {
    const query = await this.execScripts([
      {
        exec: `INSERT INTO ${this.schemaName}.config (c_key, c_value)
                       VALUES ('${key}', '${value}');`,
        param: [],
      },
    ]);
    if (query[0] === null) {
      return false;
    }
    return true;
  }

  async getConfig(key: string): Promise<ConfigType | undefined> {
    const query = await this.execScripts([
      {
        exec: `SELECT *
                       FROM ${this.schemaName}.config
                       WHERE c_key = '${key}'`,
        param: [],
      },
    ]);
    return query.length === 1 &&
      query[0]?.rows.length === 1 &&
      query[0].rows[0] !== null
      ? query[0].rows[0]
      : undefined;
  }

  async execScripts(list: RawQuery[]): Promise<(QueryResult | null)[]> {
    const output: (QueryResult | null)[] = [];
    try {
      for (const el of list) {
        const res = await this.db?.query(el.exec, el.param);
        if (res) {
          output.push(res);
        } else {
          output.push(null);
        }
      }
      return output;
    } catch (e) {
      this.error(e);
      return [];
    }
  }

  async disconnect(): Promise<boolean> {
    if (this.db) {
      await this.db.end();
      return true;
    }
    return false;
  }
}
