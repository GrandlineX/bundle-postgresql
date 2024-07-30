import {
  ConfigType,
  CoreDBCon,
  CoreEntity,
  EntityConfig,
  EProperties,
  EUpDateProperties,
  getColumnMeta,
  ICoreCache,
  ICoreClient,
  ICoreKernel,
  ICoreKernelModule,
  ICorePresenter,
  IDataBase,
  IEntity,
  QueryInterface,
  RawQuery,
} from '@grandlinex/core';

import { Client, QueryResult } from 'pg';
import {
  buildSearchQ,
  mappingWithDataType,
  objToTable,
  rowToObj,
  tableToObj,
} from '../util/index.js';

type PGDBType = Client;

export default class PGCon<
    K extends ICoreKernel<any> = ICoreKernel<any>,
    T extends IDataBase<any, any> | null = any,
    P extends ICoreClient | null = any,
    C extends ICoreCache | null = any,
    X extends ICorePresenter<any> | null = any,
  >
  extends CoreDBCon<PGDBType, QueryResult | null, K, T, P, C, X>
  implements IDataBase<PGDBType, QueryResult | null, K, T, P, C, X>
{
  db: PGDBType | null;

  constructor(
    module: ICoreKernelModule<any, any, any, any, any>,
    dbversion: string,
  ) {
    super(dbversion, module.getName(), module);

    this.db = null;
  }

  async createEntity<E extends CoreEntity>(
    config: EntityConfig<E>,
    entity: EProperties<E>,
  ): Promise<E> {
    const [keys, values, params] = objToTable(config, entity);

    const result = await this.execScripts([
      {
        exec: `INSERT INTO ${this.schemaName}.${config.className}(${keys.join(
          ', ',
        )})
                       VALUES (${values.join(', ')})
                       returning e_id;`,
        param: params,
      },
    ]);
    if (!result[0] || !result[0].rows[0]) {
      throw this.lError('Cant create entity');
    }

    return entity as E;
  }

  async updateEntity<E extends CoreEntity>(
    config: EntityConfig<E>,
    e_id: string,
    entity: EUpDateProperties<E>,
  ): Promise<boolean> {
    const [, values, params] = objToTable(config, entity, true);
    const idd = `$${values.length + 1}`;
    const result = await this.execScripts([
      {
        exec: `UPDATE ${this.schemaName}.${config.className}
                           SET ${values.join(', ')}
                           WHERE e_id = ${idd};`,
        param: [...params, e_id],
      },
    ]);

    return !!result[0];
  }

  async updateBulkEntity<E extends IEntity>(
    config: EntityConfig<E>,
    e_id: string[],
    entity: EUpDateProperties<E>,
  ): Promise<boolean> {
    const [, values, params] = objToTable(config, entity, true);
    let idd = values.length + 1;
    const result = await this.execScripts([
      {
        exec: `UPDATE ${this.schemaName}.${config.className}
                           SET ${values.join(', ')}
                           WHERE e_id  in (${e_id.map(() => `$${idd++}`).join(',')});`,
        param: [...params, ...e_id],
      },
    ]);

    return !!result[0];
  }

  async getEntityById<E extends CoreEntity>(
    config: EntityConfig<E>,
    e_id: string,
  ): Promise<E | null> {
    const query = await this.execScripts([
      {
        exec: `SELECT *
                       FROM ${this.schemaName}.${config.className}
                       WHERE e_id = $1;`,
        param: [e_id],
      },
    ]);

    const res = query[0]?.rows[0];
    if (res) {
      return rowToObj<E>(config, res);
    }
    return null;
  }

  async getEntityBulkById<E extends CoreEntity>(
    config: EntityConfig<E>,
    e_id: string[],
  ): Promise<E[]> {
    let counter = 1;
    const query = await this.execScripts([
      {
        exec: `SELECT *
                       FROM ${this.schemaName}.${config.className}
                       WHERE e_id in (${e_id.map(() => `$${counter++}`).join(',')});`,
        param: [...e_id],
      },
    ]);

    const res = query[0]?.rows;
    if (res) {
      return tableToObj<E>(config, res);
    }
    return [];
  }

  async deleteEntityById(className: string, e_id: string): Promise<boolean> {
    const query = await this.execScripts([
      {
        exec: `DELETE
                       FROM ${this.schemaName}.${className}
                       WHERE e_id = $1;`,
        param: [e_id],
      },
    ]);
    return query[0] !== null;
  }

  async deleteEntityBulkById(
    className: string,
    e_id: string[],
  ): Promise<boolean> {
    let counter = 1;
    const query = await this.execScripts([
      {
        exec: `DELETE
                       FROM ${this.schemaName}.${className}
                       WHERE e_id in (${e_id.map(() => `$${counter++}`).join(',')});`,
        param: [...e_id],
      },
    ]);
    return query[0] !== null;
  }

  async findEntity<E extends CoreEntity>(
    config: EntityConfig<E>,
    search: { [D in keyof E]?: E[D] | undefined },
  ): Promise<E | null> {
    let searchQ = '';
    const param: any[] = [];

    searchQ = buildSearchQ<E>(config, search, param, searchQ);

    const query = await this.execScripts([
      {
        exec: `SELECT * FROM ${this.schemaName}.${config.className} ${searchQ};`,
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
    q: QueryInterface<E>,
  ): Promise<E[]> {
    const { limit, config, search, offset, order } = q;
    if (limit === 0) {
      return [];
    }
    let searchQ = '';
    const orderBy: string[] = [];
    let orderByQ = '';
    const off = offset !== undefined ? ` OFFSET ${offset}` : '';
    const range = limit ? ` LIMIT ${limit}${off}` : '';
    const param: any[] = [];
    if (search) {
      searchQ = buildSearchQ<E>(config, search, param, searchQ);
    }
    if (order && order.length > 0) {
      order.forEach((val) => {
        orderBy.push(`${String(val.key)} ${val.order}`);
      });
      orderByQ = `ORDER BY ${orderBy.join(',\n')}`;
    }
    const query = await this.execScripts([
      {
        exec: `SELECT * FROM ${this.schemaName}.${config.className} 
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
    entity: E,
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
      } else {
        const type = typeof entity[key];
        switch (type) {
          case 'bigint':
          case 'number':
            out.push(`${String(key)} INT`);
            break;
          case 'string':
            out.push(`${String(key)} TEXT`);
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

  async initNewDB(): Promise<void> {
    this.debug('no init');
  }

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
             where schema_name = '${this.schemaName}';`,
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
                       VALUES ('${key}', '${value}')
               ON CONFLICT (c_key) DO UPDATE
               SET c_value = excluded.c_value;`,
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
