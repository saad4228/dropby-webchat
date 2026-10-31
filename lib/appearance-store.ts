export type Appearance = {
  theme: string;
  accent: string;
  sent: string;
  received: string;
  opacity: number;
  blur: number;
  background: string;
  animations: boolean;
};
export const defaultAppearance: Appearance = {
  theme: "",
  accent: "",
  sent: "",
  received: "",
  opacity: 85,
  blur: 16,
  background: "",
  animations: true,
};

const backgrounds = new Map<string, string>();
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("dropby-personal-appearance", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("wallpapers");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function wallpaper(
  slug: string,
  value?: string,
): Promise<string | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      "wallpapers",
      value === undefined ? "readonly" : "readwrite",
    );
    const store = tx.objectStore("wallpapers");
    const request =
      value === undefined
        ? store.get(slug)
        : value
          ? store.put(value, slug)
          : store.delete(slug);
    let result: string | undefined;
    request.onsuccess = () => {
      result = typeof request.result === "string" ? request.result : undefined;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function loadAppearance(slug: string) {
  let saved: any = {};
  try {
    saved = JSON.parse(
      localStorage.getItem("dropby-appearance:" + slug) || "{}",
    );
  } catch {}
  try {
    const image = await wallpaper(slug);
    if (image !== undefined) saved.background = image;
  } catch {}
  backgrounds.set(slug, saved.background || "");
  return saved;
}
export async function saveAppearance(
  slug: string,
  appearance: { background: string },
) {
  const { background, ...rest } = appearance;
  if (backgrounds.get(slug) !== background) {
    await wallpaper(slug, background);
    backgrounds.set(slug, background);
  }
  localStorage.setItem(
    "dropby-appearance:" + slug,
    JSON.stringify({ ...rest, background: "" }),
  );
}
