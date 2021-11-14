import {
  ConfigType,
  CoreDBCon,
  CoreEntity,
  ICoreKernelModule,
  IDataBase,
} from '@grandlinex/core';
import { RawQuery } from '@grandlinex/core/dist/lib';

import { Client, QueryResult } from 'pg';

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

  async createEntity<E extends CoreEntity>(entity: E): Promise<E | null> {
    const clone: any = entity;
    const keys = Object.keys(entity);
    const param: any[] = [];
    const vals: string[] = [];
    const newKeys: string[] = [];
    let index = 1;
    keys.forEach((key) => {
      if (key === 'e_id' && clone[key] === null) {
        return;
      }
      newKeys.push(key);
      param.push(clone[key]);
      vals.push(`$${index}`);
      index++;
    });
    const result = await this.execScripts([
      {
        exec: `INSERT INTO ${this.schemaName}.${
          entity.constructor.name
        }(${newKeys.join(', ')}) VALUES (${vals.join(', ')}) returning e_id`,
        param,
      },
    ]);
    clone.e_id = result[0]?.rows[0]?.e_id;
    return clone;
  }

  async updateEntity<E extends CoreEntity>(entity: E): Promise<E | null> {
    if (entity.e_id) {
      await this.deleteEntityById(entity.constructor.name, entity.e_id);
      await this.createEntity(entity);
      return entity;
    }
    return null;
  }

  async getEntityById<E extends CoreEntity>(
    className: string,
    id: number
  ): Promise<E | null> {
    const query = await this.execScripts([
      {
        exec: `SELECT * FROM ${this.schemaName}.${className} WHERE e_id=${id};`,
        param: [],
      },
    ]);
    return query[0]?.rows[0];
  }

  async deleteEntityById(className: string, id: number): Promise<boolean> {
    const query = await this.execScripts([
      {
        exec: `DELETE FROM ${this.schemaName}.${className} WHERE e_id=${id};`,
        param: [],
      },
    ]);
    return query[0] !== null;
  }

  async getEntityList<E extends CoreEntity>(
    className: string,
    search: {
      [P in keyof E]: E[P];
    }
  ): Promise<E[]> {
    let searchQ = '';
    const param: any[] = [];
    if (search) {
      const keys: (keyof E)[] = Object.keys(search) as (keyof E)[];
      if (keys.length > 0) {
        const filter: string[] = [];
        let count = 1;
        for (const key of keys) {
          if (search[key] !== undefined) {
            filter.push(`${key} = $${count++}`);
            param.push(search[key]);
          }
        }
        if (filter.length > 0) {
          searchQ = ` WHERE ${filter.join(' AND ')}`;
        }
      }
    }
    const query = await this.execScripts([
      {
        exec: `SELECT * FROM ${this.schemaName}.${className}${searchQ};`,
        param,
      },
    ]);
    return query[0]?.rows || [];
  }

  async initEntity<E extends CoreEntity>(entity: E): Promise<boolean> {
    await this.execScripts([
      {
        exec: `CREATE TABLE ${this.schemaName}.${
          entity.constructor.name
        }(${this.transformEntityKeys<E>(entity)});`,
        param: [],
      },
    ]);
    return true;
  }

  transformEntityKeys<E extends CoreEntity>(entity: E): string {
    const keys: (keyof E)[] = Object.keys(entity) as (keyof E)[];
    const out: string[] = [];

    keys.forEach((key) => {
      if (key === 'e_id') {
        out.push(`e_id SERIAL PRIMARY KEY`);
      } else {
        const type = typeof entity[key];
        const dat = entity[key] as any;
        switch (type) {
          case 'bigint':
          case 'number':
            out.push(`${key} INT`);
            break;
          case 'string':
            out.push(`${key} TEXT`);
            break;
          case 'object':
            if (dat instanceof Date) {
              out.push(`${key} TEXT`);
            }
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
