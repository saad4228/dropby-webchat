function base64url(value: Uint8Array | string) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
export async function callConfig(
  vars: Record<string, string>,
  roomId: string,
  user: { id: string; name: string },
) {
  const url = vars.LIVEKIT_URL,
    key = vars.LIVEKIT_API_KEY,
    secret = vars.LIVEKIT_API_SECRET;
  if (!url && !key && !secret) return null;
  if (!url || !key || !secret || !/^wss:\/\//.test(url))
    throw Object.assign(
      new Error(
        "The call service is not ready. Please ask the room owner to check its configuration.",
      ),
      { status: 503 },
    );
  const now = Math.floor(Date.now() / 1000);
  const encoded =
    base64url(JSON.stringify({ alg: "HS256", typ: "JWT" })) +
    "." +
    base64url(
      JSON.stringify({
        iss: key,
        sub: user.id,
        name: user.name,
        nbf: now - 10,
        exp: now + 600,
        jti: crypto.randomUUID(),
        video: {
          room: "dropby-" + roomId,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        },
      }),
    );
  const signingKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      signingKey,
      new TextEncoder().encode(encoded),
    ),
  );
  return {
    url,
    token: encoded + "." + base64url(signature),
    limit: Math.max(4, Math.min(100, Number(vars.CALL_MEMBER_LIMIT) || 32)),
  };
}
