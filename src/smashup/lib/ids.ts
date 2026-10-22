/**
 * Action ids and room codes. Both use getRandomValues, which unlike randomUUID
 * also works on plain http (a phone trying the dev server over the LAN).
 */

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export const ID_PATTERN = /^[A-Za-z0-9_-]{8,40}$/;

/** 132 random bits as 22 URL-safe characters. */
export function newId(): string {
  // 64 divides 256, so masking keeps every character equally likely.
  return Array.from(crypto.getRandomValues(new Uint8Array(22)), (byte) => ID_ALPHABET[byte & 63]).join("");
}

/** No vowels, so no words, and nothing that reads as another character (0/O, 1/I). */
export const ROOM_ALPHABET = "23456789BCDFGHJKLMNPQRSTVWXZ";
export const ROOM_CODE_LENGTH = 5;

export function newRoomCode(): string {
  // Bytes from 252 up are thrown away so each of the 28 characters is equally likely.
  const limit = 256 - (256 % ROOM_ALPHABET.length);
  let code = "";
  while (code.length < ROOM_CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(8))) {
      if (byte < limit && code.length < ROOM_CODE_LENGTH) code += ROOM_ALPHABET[byte % ROOM_ALPHABET.length];
    }
  }
  return code;
}

/** A typed or linked room code, ignoring case, spaces and dashes; null if it can't be one. */
export function parseRoomCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.replace(/[\s-]/g, "").toUpperCase();
  return code.length === ROOM_CODE_LENGTH && [...code].every((char) => ROOM_ALPHABET.includes(char)) ? code : null;
}
