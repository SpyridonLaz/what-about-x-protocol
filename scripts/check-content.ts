// Content integrity check, run by `npm run check` and CI before every build:
//  1. every protocol scenario is structurally valid;
//  2. every supported locale has a messages file with exactly the English keys
//     and the same {placeholders}.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES } from '../src/i18n/locales';
import { checkLocale, englishMessages } from '../src/i18n/messages';
import { PROTOCOLS } from '../src/protocols';
import { validateAll } from '../src/protocols/validate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const msgDir = join(root, 'src', 'i18n', 'messages');

function main(): void {
  const errors: string[] = [...validateAll(PROTOCOLS)];
  const en = englishMessages();
  for (const { code } of LOCALES) {
    if (code === 'en') continue;
    const file = join(msgDir, `${code}.json`);
    if (!existsSync(file)) {
      errors.push(`[${code}] missing file src/i18n/messages/${code}.json`);
      continue;
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`[${code}] invalid JSON: ${(e as Error).message}`);
      continue;
    }
    errors.push(...checkLocale(code, en, data));
  }

  const keys = Object.keys(en).length;
  if (errors.length) {
    const shown = errors.slice(0, 60);
    console.error(shown.join('\n'));
    if (errors.length > shown.length) console.error(`… and ${errors.length - shown.length} more`);
    console.error(`\n✗ ${errors.length} content problem(s). ${PROTOCOLS.length} protocols, ${LOCALES.length} locales, ${keys} keys.`);
    process.exit(1);
  }
  console.log(`✓ content OK: ${PROTOCOLS.length} protocols, ${LOCALES.length} locales × ${keys} keys.`);
}

main();
