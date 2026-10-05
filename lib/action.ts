export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type LoginState = { error: string | null };
