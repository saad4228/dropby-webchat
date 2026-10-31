declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    SUPABASE_URL?: string;
    SUPABASE_MEDIA_BUCKET?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    MEDIA_ADMIN_IDS?: string;
    MEDIA_STORAGE_BUDGET_BYTES?: string;
  }
}
