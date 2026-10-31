import { env } from "cloudflare:workers";

export type Row = Record<string, any>;
export const db = () => {
  if (!env.DB) throw new Error("Database is not configured");
  return env.DB;
};
export const first = async (sql: string, ...values: any[]) =>
  db()
    .prepare(sql)
    .bind(...values)
    .first<Row>();
export const all = async (sql: string, ...values: any[]) =>
  (
    await db()
      .prepare(sql)
      .bind(...values)
      .all<Row>()
  ).results;
export const run = async (sql: string, ...values: any[]) =>
  db()
    .prepare(sql)
    .bind(...values)
    .run();
export const fail = (message: string, status = 400): never => {
  throw Object.assign(new Error(message), { status });
};
export const json = (
  value: any,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
