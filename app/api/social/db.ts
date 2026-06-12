import { pool } from "@/app/lib/db";
import { DEFAULT_PROMPT } from "./prompt";


export { pool };

export async function loadPrompt(): Promise<string> {
  const result = await pool.query(`SELECT value FROM social_settings WHERE key = 'custom_prompt'`).catch(() => ({ rows: [] as { value: string }[] }));
  return result.rows[0]?.value ?? DEFAULT_PROMPT;
}
