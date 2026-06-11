#!/usr/bin/env node
/**
 * Encrypt a fine-grained GitHub token for the /write page.
 *
 * The token is sealed with AES-256-GCM, key derived from your password via
 * PBKDF2-SHA256 (310k iterations) — same scheme as /family-tree. The sealed
 * blob is safe to commit; without the password it is unreadable.
 *
 * Setup:
 *  1. Create a fine-grained PAT at https://github.com/settings/personal-access-tokens
 *     - Repository access: ONLY pruthvishetty/pruthvishetty.github.io
 *     - Permissions: Contents → Read and write. Nothing else.
 *  2. Run: npm run encrypt-token
 *  3. Commit the generated public/write/token.enc.json
 */
import { webcrypto as crypto } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const token = (await rl.question('GitHub fine-grained token (contents:write on this repo only): ')).trim();
const password = (await rl.question('Password for /write (pick something strong & memorable): ')).trim();
rl.close();

if (!token || !password) {
  console.error('Both token and password are required.');
  process.exit(1);
}

const ITERATIONS = 310_000;
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
  baseKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt']
);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token)));

const b64 = (u8) => Buffer.from(u8).toString('base64');
const blob = { v: 1, iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ct) };

await mkdir(new URL('../public/write', import.meta.url), { recursive: true });
const out = new URL('../public/write/token.enc.json', import.meta.url);
await writeFile(out, JSON.stringify(blob, null, 2) + '\n');
console.log('\n✓ Wrote public/write/token.enc.json — commit it, then visit /write and unlock with your password.');
