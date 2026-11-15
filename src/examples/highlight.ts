// Tiny syntax colouring for wire text (HTTP header blocks, SSE lines, JSON, // comments).
// Pure: turns text into typed tokens; the view turns tokens into <span>s. Joining the
// token texts always gives back the input, so nothing is lost or invented.
import type { WireLang } from './types';

/** start = request/status line, key = header or JSON key, str/num/lit = JSON values, com = comment, punc = brackets. */
export type TokenKind = 'start' | 'key' | 'str' | 'num' | 'lit' | 'com' | 'punc' | 'plain';

export interface Token {
  kind: TokenKind;
  text: string;
}

const START_LINE = /^(?:HTTP\/\d(?:\.\d)? \d{3}\b|[A-Z]+ \S.* HTTP\/\d(?:\.\d)?$|[A-Z]+ \/\S*$)/;
const HEADER = /^([A-Za-z][\w-]*)(:)(.*)$/;
const SSE = /^(event|data|id|retry)(:)(.*)$/;
const JSON_TOKEN = /"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?![\w.])|\b(?:true|false|null)\b|[{}[\],:]|\s+|[^\s"{}[\],:]+|"/g; // the last branch keeps a stray quote (unterminated string)

function jsonTokens(text: string): Token[] {
  const out: Token[] = [];
  const parts = text.match(JSON_TOKEN) ?? [];
  parts.forEach((part, i) => {
    let kind: TokenKind = 'plain';
    if (part[0] === '"') {
      // A string followed by a colon is a key.
      let j = i + 1;
      while (j < parts.length && !parts[j].trim()) j++;
      kind = parts[j] === ':' ? 'key' : 'str';
    } else if (/^-?\d/.test(part)) kind = 'num';
    else if (part === 'true' || part === 'false' || part === 'null') kind = 'lit';
    else if (/^[{}[\],:]$/.test(part)) kind = 'punc';
    out.push({ kind, text: part });
  });
  return out;
}

/** True when `text` ends inside a JSON string (an odd number of unescaped quotes). */
function insideString(text: string): boolean {
  let open = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && open) i++;
    else if (text[i] === '"') open = !open;
  }
  return open;
}

/** Tokens of one line; `inHeaders` says whether the line sits in an HTTP header block. */
function lineTokens(line: string, lang: WireLang, inHeaders: boolean): Token[] {
  if (!line) return [];
  if (/^\s*\/\//.test(line)) return [{ kind: 'com', text: line }];
  if (lang === 'text') return [{ kind: 'plain', text: line }];
  if (START_LINE.test(line)) return [{ kind: 'start', text: line }];
  if (inHeaders) {
    const m = HEADER.exec(line);
    if (m) return [{ kind: 'key', text: m[1] }, { kind: 'punc', text: m[2] }, { kind: 'plain', text: m[3] }];
    return [{ kind: 'plain', text: line }]; // continuation of a long request line
  }
  const sse = SSE.exec(line);
  if (sse) {
    const rest = sse[1] === 'data' ? jsonTokens(sse[3]) : [{ kind: 'lit' as const, text: sse[3] }];
    return [{ kind: 'key', text: sse[1] }, { kind: 'punc', text: sse[2] }, ...rest];
  }
  // A trailing // comment after JSON.
  // The first " // " that is not inside a string starts the comment.
  const re = /\s+\/\/ /g;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    const before = line.slice(0, m.index);
    if (!insideString(before)) return [...jsonTokens(before), { kind: 'com', text: line.slice(m.index) }];
    re.lastIndex = m.index + 1;
  }
  return jsonTokens(line);
}

/** Tokens per line. An HTTP start line opens a header block; the first empty line closes it. */
export function highlight(body: string, lang: WireLang): Token[][] {
  let inHeaders = false;
  return body.split('\n').map((line) => {
    if (lang !== 'text' && START_LINE.test(line)) {
      inHeaders = true;
      return lineTokens(line, lang, false);
    }
    if (!line.trim()) {
      inHeaders = false;
      return [];
    }
    // A request line may wrap over several indented lines before its headers start.
    return lineTokens(line, lang, inHeaders);
  });
}
