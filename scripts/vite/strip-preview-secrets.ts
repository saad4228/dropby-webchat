import type { Plugin } from "vite";

// Cloudflare generates this file for local preview. Load the canonical file
// explicitly when previewing, and keep credentials out of packaged builds.
export function stripPreviewSecrets(): Plugin {
  return {
    name: "dropby-strip-preview-secrets",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        for (const name of Object.keys(bundle))
          if (name.split("/").at(-1) === ".dev.vars") delete bundle[name];
      },
    },
  };
}
