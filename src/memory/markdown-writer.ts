import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadConfig } from '../config.js';

/**
 * Низкоуровневая запись Markdown в OBSIDIAN_VAULT_PATH.
 * Совместимо с Obsidian: обычные .md, frontmatter, wiki-подобные имена файлов.
 */

/** Маскирование персональных данных перед записью в общие журналы. */
export function maskPII(text: string): string {
  return text
    // телефоны: +998 90 123 45 67 → +998 90 1** ** **
    .replace(/(\+\d{3}[\s()-]?\d{2}[\s()-]?\d)[\d\s()-]{4,}/g, '$1** ** **')
    // email: name@example.com → n***@example.com
    .replace(/\b([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, '$1***@$2');
}

export function vaultPath(...parts: string[]): string {
  return join(loadConfig().OBSIDIAN_VAULT_PATH, ...parts);
}

export async function writeNote(relPath: string, content: string): Promise<string> {
  const full = vaultPath(relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, maskPII(content), 'utf8');
  return full;
}

export async function appendNote(relPath: string, content: string): Promise<string> {
  const full = vaultPath(relPath);
  await mkdir(dirname(full), { recursive: true });
  await appendFile(full, maskPII(content), 'utf8');
  return full;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function frontmatter(fields: Record<string, string | number>): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${String(v).replace(/\n/g, ' ')}`);
  return `---\n${lines.join('\n')}\n---\n\n`;
}
