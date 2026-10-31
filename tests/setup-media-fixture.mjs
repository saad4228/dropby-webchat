import {
  cpSync,
  existsSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
const project = process.cwd(),
  destination = path.resolve("outputs/media-fixture-project");
if (existsSync(destination))
  throw new Error("Fixture directory already exists");
mkdirSync(destination, { recursive: true });
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
for (const file of files) {
  if (!existsSync(file)) continue;
  const target = path.join(destination, file);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(file, target);
}
symlinkSync(
  path.join(project, "node_modules"),
  path.join(destination, "node_modules"),
  process.platform === "win32" ? "junction" : "dir",
);
writeFileSync(
  path.join(destination, ".dev.vars"),
  "SUPABASE_URL=http://127.0.0.1:7799\nSUPABASE_SERVICE_ROLE_KEY=fixture-storage-only\nSUPABASE_MEDIA_BUCKET=dropby-media\nMEDIA_ADMIN_IDS=media-fixture-admin\n",
);
writeFileSync(
  path.join(destination, "wrangler.fixture.jsonc"),
  JSON.stringify({
    name: "media-fixture",
    main: "worker/index.ts",
    compatibility_date: "2026-05-15",
    compatibility_flags: ["nodejs_compat"],
    d1_databases: [
      {
        binding: "DB",
        database_name: "media-fixture",
        database_id: "00000000-0000-4000-8000-000000000000",
        migrations_dir: "drizzle",
      },
    ],
  }),
);
console.log(
  "Created isolated local media fixture; real credentials were excluded.",
);
