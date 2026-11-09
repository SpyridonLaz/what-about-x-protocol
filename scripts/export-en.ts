// Writes the English reference messages to src/i18n/messages/en.reference.json (input for translators).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { englishMessages } from '../src/i18n/messages';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'translations', 'en.json');
const en = englishMessages();
writeFileSync(out, JSON.stringify(en, null, 2) + '\n', 'utf8');
console.log(`wrote ${Object.keys(en).length} keys, ${Object.values(en).join('').length} characters → translations/en.json`);
