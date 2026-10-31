import { first, run, fail, type Row } from "./server-utils";

export const hash = async (text: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
export async function passwordHash(
  password: string,
  salt = crypto.randomUUID(),
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return (
    salt +
    ":" +
    Array.from(new Uint8Array(bits))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}
export async function rate(key: string, limit: number, window = 60000) {
  const bucket = Math.floor(Date.now() / window);
  const k = key + ":" + bucket;
  const r = await first(
    "INSERT INTO rate_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    k,
    Date.now() + window,
  );
  if (r && r.count > limit)
    fail("A little too fast. Please wait a moment.", 429);
}
export async function session(req: Request): Promise<Row | null> {
  // Sites dispatch owns these verified headers and strips visitor-supplied values.
  const accountId = req.headers.get("oai-authenticated-user-id");
  if (accountId) {
    const account = await first(
      "SELECT id,name,avatar,avatarImageId,color,expires FROM sessions WHERE accountId=?",
      accountId,
    );
    if (account)
      return {
        ...account,
        avatar: account.avatarImageId
          ? "media:" + account.avatarImageId
          : account.avatar,
        signedIn: true,
      };
  }
  const token = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)dropby_session=([^;]+)/)?.[1];
  if (!token) return null;
  const guest = await first(
    "SELECT id,name,avatar,avatarImageId,color,expires,accountId FROM sessions WHERE tokenHash=? AND expires>?",
    await hash(token),
    Date.now(),
  );
  if (!guest || (guest.accountId && guest.accountId !== accountId)) return null;
  if (accountId)
    await run(
      "UPDATE sessions SET accountId=? WHERE id=? AND accountId IS NULL",
      accountId,
      guest.id,
    );
  const { accountId: unused, ...identity } = guest;
  return {
    ...identity,
    avatar: identity.avatarImageId
      ? "media:" + identity.avatarImageId
      : identity.avatar,
    signedIn: !!accountId,
  };
}
export async function access(slug: string, user: Row) {
  const room = await first("SELECT * FROM rooms WHERE slug=?", slug);
  if (!room) fail("This room is unavailable.", 404);
  const member = await first(
    "SELECT * FROM memberships WHERE roomId=? AND sessionId=?",
    room!.id,
    user.id,
  );
  if (!member || member.banned)
    fail(
      "This room is unavailable. Join with a valid invitation or password.",
      403,
    );
  return { room: room!, member: member! };
}
export const safeRoom = (r: Row) => ({
  id: r.id,
  slug: r.slug,
  description: r.description,
  visibility: r.visibility,
  theme: r.theme,
  locked: !!r.locked,
  owner: r.owner,
  logo: r.logo,
  logoImageId: r.logoImageId,
});
export const admin = (m: Row) => m.role === "owner" || m.role === "moderator";
