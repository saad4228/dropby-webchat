// Build/preview only. This script never pushes, applies remote SQL or deploys.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { unstable_readConfig } from "wrangler";
const [command, ...args] = process.argv.slice(2);
if (!["build", "dev"].includes(command))
  throw new Error("Expected build or dev.");
const result = spawnSync(
  process.execPath,
  ["scripts/run-framework.mjs", command, ...args],
  {
    stdio: "inherit",
    env: { ...process.env, DROPBY_DEPLOY_TARGET: "cloudflare" },
  },
);
if (result.error) throw result.error;
if (result.status) process.exit(result.status);
if (command === "build") {
  const expected = unstable_readConfig({ config: "wrangler.jsonc" });
  const built = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
  const binding = built.d1_databases?.find((x) => x.binding === "DB");
  if (
    binding?.database_id !== expected.d1_databases[0].database_id ||
    built.r2_buckets?.length
  )
    throw new Error("Unexpected storage bindings in production build.");
  built.account_id = expected.account_id;
  built.keep_vars = true;
  writeFileSync(
    "dist/server/wrangler.json",
    JSON.stringify(built, null, 2) + "\n",
  );
  console.log(
    "Cloudflare build verified: production D1 binding, private Supabase media, no object-storage binding.",
  );
}
