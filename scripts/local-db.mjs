import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function database(path=':memory:') {
  const db=new DatabaseSync(path);
  db.exec(readFileSync(new URL('../migrations/0001_certificates.sql',import.meta.url),'utf8'));
  return {
    close:()=>db.close(),
    prepare(sql) {
      let values=[];
      const statement={
        bind(...args){values=args;return statement;},
        async first(){return db.prepare(sql).get(...values)||null;},
        async all(){return {results:db.prepare(sql).all(...values)};},
        async run(){return {meta:{changes:db.prepare(sql).run(...values).changes}};}
      };return statement;
    }
  };
}
