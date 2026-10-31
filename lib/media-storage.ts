import { env } from "cloudflare:workers";
import { MEDIA_CONFIG } from "./media-config";
import { fail } from "./server-utils";

export function storageSettings() {
  const vars = env as unknown as Record<string, string>;
  const base = vars.SUPABASE_URL?.replace(/\/$/, "");
  const key = vars.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key)
    fail(
      "Media uploads are not configured yet. Text chat still works. Ask the administrator to connect private storage.",
      503,
    );
  let url: URL;
  try {
    url = new URL(base!);
  } catch {
    return fail(
      "The media storage project URL is invalid. Ask the administrator to check SUPABASE_URL. Text chat still works.",
      503,
    );
  }
  if (url.pathname !== "/" || url.search || url.hash)
    fail(
      "Use the Supabase project root URL without /rest/v1 or /storage/v1. Text chat still works.",
      503,
    );
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    fail("Storage needs a secure project URL.", 503);
  return {
    base: base!,
    key: key!,
    bucket: vars.SUPABASE_MEDIA_BUCKET || MEDIA_CONFIG.bucket,
  };
}
function objectPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}
async function storageRequest(
  path: string,
  init: RequestInit = {},
  missingOkay = false,
) {
  const settings = storageSettings();
  let response: Response;
  try {
    response = await fetch(settings.base + "/storage/v1" + path, {
      ...init,
      signal: AbortSignal.timeout(120000),
      headers: {
        apikey: settings.key,
        Authorization: `Bearer ${settings.key}`,
        ...init.headers,
      },
    });
  } catch {
    return fail(
      "Private storage is temporarily unreachable. Your text messages still work; retry the upload shortly.",
      503,
    );
  }
  if (missingOkay && response.status === 400) {
    const error = (await response
      .clone()
      .json()
      .catch(() => ({}))) as { code?: string; statusCode?: string | number };
    if (error.code === "NoSuchKey" || String(error.statusCode) === "404") {
      await response.body?.cancel();
      return new Response(null, { status: 404 });
    }
  }
  if (!response.ok && !(missingOkay && [404, 416].includes(response.status))) {
    // Never relay upstream error bodies: they can contain credentials or paths.
    await response.body?.cancel();
    if ([401, 403].includes(response.status))
      fail(
        "Private storage authorization failed. Ask the administrator to check the server key and bucket permissions.",
        503,
      );
    if ([413, 507].includes(response.status))
      fail(
        "Storage cannot accept this upload right now. The administrator may need to free space or adjust the bucket limit.",
        413,
      );
    if (response.status === 429)
      fail("Storage is busy. Please wait a moment and retry.", 429);
    fail(
      "Private storage could not complete this operation. Please retry; your other conversations still work.",
      503,
    );
  }
  return response;
}
export async function verifyPrivateBucket() {
  const { bucket } = storageSettings();
  const response = await storageRequest(
    `/bucket/${encodeURIComponent(bucket)}`,
    {},
    true,
  );
  if (response.status === 404)
    fail(
      "The configured private media bucket was not found. Ask the administrator to check SUPABASE_MEDIA_BUCKET.",
      503,
    );
  const data = (await response.json()) as {
    public?: boolean;
    file_size_limit?: number | string | null;
  };
  if (data.public !== false)
    fail(
      "Media storage must use a private bucket. Ask the administrator to correct its visibility.",
      503,
    );
}
export async function authorizeUpload(path: string) {
  const { base, bucket } = storageSettings();
  const response = await storageRequest(
    `/object/upload/sign/${encodeURIComponent(bucket)}/${objectPath(path)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-upsert": "false" },
      body: JSON.stringify({}),
    },
  );
  const data = (await response.json()) as {
    url?: string;
    signedURL?: string;
    token?: string;
  };
  const signed = data.url || data.signedURL;
  const token =
    data.token ||
    (signed ? new URL(signed, base).searchParams.get("token") : "");
  if (!token)
    fail("Storage could not authorize the upload. Please retry.", 503);
  const direct = new URL(base);
  if (
    direct.hostname.endsWith(".supabase.co") &&
    !direct.hostname.endsWith(".storage.supabase.co")
  )
    direct.hostname = direct.hostname.replace(
      ".supabase.co",
      ".storage.supabase.co",
    );
  return {
    token,
    bucket,
    path,
    tusEndpoint: direct.origin + "/storage/v1/upload/resumable",
    uploadUrl: `${base}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${objectPath(path)}?token=${encodeURIComponent(token!)}`,
  };
}
export async function storageHead(path: string) {
  const { bucket } = storageSettings();
  // Supabase can return HTTP 400 with a structured NoSuchKey; HEAD hides that body.
  const response = await storageRequest(
    `/object/info/authenticated/${encodeURIComponent(bucket)}/${objectPath(path)}`,
    {},
    true,
  );
  if (response.status === 404) return null;
  const data = (await response.json()) as {
    size?: number;
    contentType?: string;
    content_type?: string;
    metadata?: { size?: number; mimetype?: string };
  };
  return {
    size: Number(data.size ?? data.metadata?.size),
    mime:
      data.contentType || data.content_type || data.metadata?.mimetype || "",
  };
}
export async function storageRead(path: string, range?: string) {
  const { bucket } = storageSettings();
  return storageRequest(
    `/object/authenticated/${encodeURIComponent(bucket)}/${objectPath(path)}`,
    {
      headers: {
        "Accept-Encoding": "identity",
        ...(range ? { Range: range } : {}),
      },
    },
    true,
  );
}
export async function signedRead(path: string) {
  const { base, bucket } = storageSettings();
  const response = await storageRequest(
    `/object/sign/${encodeURIComponent(bucket)}/${objectPath(path)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: MEDIA_CONFIG.signedReadSeconds }),
    },
  );
  const data = (await response.json()) as { signedURL: string };
  return new URL(
    data.signedURL.startsWith("/object/")
      ? "/storage/v1" + data.signedURL
      : data.signedURL,
    base,
  ).href;
}
export async function storageDelete(path: string) {
  const { bucket } = storageSettings();
  const response = await storageRequest(
    `/object/${encodeURIComponent(bucket)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [path] }),
    },
    true,
  );
  await response.body?.cancel();
  // Confirm absence before decrementing accounting. A DELETE returning 200 alone is insufficient.
  if (await storageHead(path))
    fail("File cleanup is still pending. Please retry shortly.", 503);
}
export async function storagePut(
  path: string,
  bytes: Uint8Array,
  mime: string,
) {
  const { bucket } = storageSettings();
  const response = await storageRequest(
    `/object/${encodeURIComponent(bucket)}/${objectPath(path)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": mime,
        "x-upsert": "false",
        "cache-control": "max-age=0",
      },
      body: bytes as unknown as BodyInit,
    },
  );
  await response.body?.cancel();
}
export async function createTus(path: string, size: number, mime: string) {
  const auth = await authorizeUpload(path);
  const settings = storageSettings();
  const metadata = {
    bucketName: auth.bucket,
    objectName: path,
    contentType: mime,
    cacheControl: "0",
  };
  const response = await fetch(auth.tusEndpoint, {
    method: "POST",
    signal: AbortSignal.timeout(120000),
    headers: {
      apikey: settings.key,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(size),
      "x-signature": auth.token!,
      "Upload-Metadata": Object.entries(metadata)
        .map(([k, v]) => k + " " + btoa(v))
        .join(","),
    },
  });
  await response.body?.cancel();
  if (response.status !== 201 || !response.headers.get("location"))
    fail("The resumable transfer could not start. Please retry.", 503);
  const location = new URL(response.headers.get("location")!, auth.tusEndpoint);
  if (location.origin !== new URL(auth.tusEndpoint).origin)
    fail("Storage returned an invalid upload location.", 503);
  return location.href;
}
export async function tusRequest(url: string, init: RequestInit) {
  // This URL only comes from createTus(), never from browser input.
  const settings = storageSettings();
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(120000),
    headers: {
      apikey: settings.key,
      Authorization: `Bearer ${settings.key}`,
      "Tus-Resumable": "1.0.0",
      ...init.headers,
    },
  });
  await response.body?.cancel();
  return response;
}
