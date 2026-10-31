// Local production preview only. No resource provisioning or deployment.
import path from "node:path";
import { readdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { Miniflare } from "miniflare";
import {
  unstable_getMiniflareWorkerOptions,
  unstable_getVarsForDev,
  unstable_readConfig,
} from "wrangler";
import { projectRoot } from "./sites-env.mjs";
const { values } = parseArgs({
  options: { port: { type: "string", default: "8787" } },
});
const file = path.join(projectRoot, "dist/server/wrangler.json");
const config = unstable_readConfig({ config: file });
const { main, workerOptions, externalWorkers } =
  unstable_getMiniflareWorkerOptions(config);
if (!main) throw new Error("Build the project before starting its preview.");
const vars = unstable_getVarsForDev(
  file,
  [path.join(projectRoot, ".dev.vars")],
  {},
  undefined,
  true,
);
const bindings = {
  ...workerOptions.bindings,
  ...Object.fromEntries(
    Object.entries(vars).map(([key, entry]) => [key, entry.value]),
  ),
};
function modulesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory()
      ? modulesIn(file)
      : /\.m?js$/.test(file)
        ? [file]
        : [];
  });
}
const modules = [
  main,
  ...modulesIn(path.dirname(main)).filter((file) => file !== main),
].map((file) => ({ type: "ESModule", path: file }));
// workerd's Windows HTTPS transport can reset sockets. This local-only bridge
// uses Node for network I/O; production Workers keep their native fetch.
async function windowsOutbound(request) {
  const response = await globalThis.fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    duplex: "half",
    signal: request.signal,
  });
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
const preview = new Miniflare({
  host: "127.0.0.1",
  port: Number(values.port),
  d1Persist: path.join(projectRoot, ".wrangler/state/v3/d1"),
  workers: [
    {
      ...workerOptions,
      name: "dropby-built-preview",
      modules,
      modulesRoot: path.dirname(main),
      bindings,
      ...(process.platform === "win32"
        ? { outboundService: windowsOutbound }
        : {}),
    },
    ...externalWorkers,
  ],
});
console.log(`Local built preview: ${await preview.ready}`);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void preview.dispose().then(() => process.exit(0));
  });
