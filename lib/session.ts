import crypto from "crypto";

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
};

const COOKIE_NAME = "pt_session";

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET env var is not set. Generate one with `openssl rand -hex 32` and add it to your environment variables."
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSession(session: Session): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const json = Buffer.from(JSON.stringify(session), "utf8");
  const encrypted = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSession(value: string | undefined): Session | null {
  if (!value) return null;
  try {
    const key = getKey();
    const raw = Buffer.from(value, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8")) as Session;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
