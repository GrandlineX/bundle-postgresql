export type TableQueryParam = string | number | boolean | string[] | number[];
export class TableQueryBuilder {
  private i;

  private searchQ: string[] = [];

  private param: TableQueryParam[] = [];

  constructor() {
    this.i = 1;
  }

  add(search: string, fields: TableQueryParam[]): void {
    this.searchQ.push(
      `(${search.replace(/\$i/g, () => `$${(this.i++).toString()}`)})`,
    );
    this.param.push(...fields);
  }

  getSearch(join: 'AND' | 'OR' = 'AND'): [string, TableQueryParam[]] {
    let search = '';
    if (this.searchQ.length > 0) {
      search += `WHERE ${this.searchQ.join(` ${join} `)}`;
    }
    return [search, this.param];
  }
}
