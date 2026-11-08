import {
  Diagnostic,
  DiagnosticSeverity,
  DocumentSymbol,
  Range,
  SymbolKind,
} from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export type TokenKind =
  | 'comment'
  | 'identifier'
  | 'keyword'
  | 'number'
  | 'operator'
  | 'punctuation'
  | 'string'
  | 'unknown';

export interface Token {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
}

export interface CoraSymbol {
  name: string;
  kind: SymbolKind;
  detail: string;
  range: Range;
  selectionRange: Range;
  isParameter?: boolean;
}

export interface Analysis {
  diagnostics: Diagnostic[];
  symbols: CoraSymbol[];
  tokens: Token[];
}

export const KEYWORD_DOCUMENTATION: Readonly<Record<string, string>> = {
  let: 'Declare a mutable local value.',
  const: 'Declare a value that cannot be reassigned.',
  var: 'Declare a mutable value.',
  fn: 'Declare a function.',
  function: 'Declare a function.',
  func: 'Declare a function.',
  type: 'Declare a named type.',
  struct: 'Declare a structure type.',
  enum: 'Declare an enumeration type.',
  trait: 'Declare a trait.',
  class: 'Declare a class.',
  module: 'Declare a module.',
  import: 'Import declarations from another module.',
  export: 'Make a declaration available to other modules.',
  if: 'Conditionally evaluate a block.',
  else: 'Evaluate an alternative block.',
  match: 'Select a branch by matching a value.',
  for: 'Iterate over a value.',
  while: 'Repeat while a condition is true.',
  return: 'Return a value from the current function.',
  break: 'Leave the current loop.',
  continue: 'Skip to the next loop iteration.',
  true: 'Boolean literal for the true value.',
  false: 'Boolean literal for the false value.',
  null: 'The empty or absent value.',
};

export const KEYWORDS = new Set(Object.keys(KEYWORD_DOCUMENTATION));

export const BUILTIN_DOCUMENTATION: Readonly<Record<string, string>> = {
  print: 'Write a value to the output.',
  input: 'Read a value from the input.',
  len: 'Return the length of a collection or string.',
  range: 'Create a sequence of values.',
  map: 'Transform each value in a collection.',
  filter: 'Keep values that satisfy a predicate.',
  reduce: 'Combine a collection into one value.',
};

const DECLARATIONS: Readonly<
  Record<string, { kind: SymbolKind; detail: string; function: boolean }>
> = {
  let: { kind: SymbolKind.Variable, detail: 'variable', function: false },
  const: { kind: SymbolKind.Constant, detail: 'constant', function: false },
  var: { kind: SymbolKind.Variable, detail: 'variable', function: false },
  fn: { kind: SymbolKind.Function, detail: 'function', function: true },
  function: { kind: SymbolKind.Function, detail: 'function', function: true },
  func: { kind: SymbolKind.Function, detail: 'function', function: true },
  type: { kind: SymbolKind.TypeParameter, detail: 'type', function: false },
  struct: { kind: SymbolKind.Struct, detail: 'struct', function: false },
  enum: { kind: SymbolKind.Enum, detail: 'enum', function: false },
  trait: { kind: SymbolKind.Interface, detail: 'trait', function: false },
  class: { kind: SymbolKind.Class, detail: 'class', function: false },
  module: { kind: SymbolKind.Namespace, detail: 'module', function: false },
};

const OPEN_DELIMITERS: Readonly<Record<string, string>> = {
  '(': ')',
  '[': ']',
  '{': '}',
};

const CLOSE_DELIMITERS = new Set(Object.values(OPEN_DELIMITERS));
const OPERATORS = [
  '>>>',
  '===',
  '!==',
  '=>',
  '->',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '??',
  '+=',
  '-=',
  '*=',
  '/=',
  '++',
  '--',
  '...',
];
const PUNCTUATION = new Set(['{', '}', '[', ']', '(', ')', ';', ',', '.', ':', '@']);

function isIdentifierStart(value: string): boolean {
  return /[A-Za-z_]/.test(value);
}

function isIdentifierPart(value: string): boolean {
  return /[A-Za-z0-9_]/.test(value);
}

function rangeFor(document: TextDocument, start: number, end: number): Range {
  return {
    start: document.positionAt(start),
    end: document.positionAt(end),
  };
}

function pushDiagnostic(
  diagnostics: Diagnostic[],
  document: TextDocument,
  start: number,
  end: number,
  message: string,
  severity: DiagnosticSeverity = DiagnosticSeverity.Error,
): void {
  diagnostics.push({
    severity,
    source: 'cora',
    message,
    range: rangeFor(document, start, end),
  });
}

function scan(document: TextDocument): { tokens: Token[]; diagnostics: Diagnostic[] } {
  const text = document.getText();
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  let offset = 0;

  while (offset < text.length) {
    const character = text[offset];

    if (/\s/.test(character)) {
      offset += 1;
      continue;
    }

    if (text.startsWith('//', offset)) {
      const start = offset;
      const lineEnd = text.indexOf('\n', offset + 2);
      offset = lineEnd === -1 ? text.length : lineEnd;
      tokens.push({ kind: 'comment', text: text.slice(start, offset), start, end: offset });
      continue;
    }

    if (text.startsWith('/*', offset)) {
      const start = offset;
      const close = text.indexOf('*/', offset + 2);
      offset = close === -1 ? text.length : close + 2;
      tokens.push({ kind: 'comment', text: text.slice(start, offset), start, end: offset });
      if (close === -1) {
        pushDiagnostic(diagnostics, document, start, offset, 'Unterminated block comment.');
      }
      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      const start = offset;
      const quote = character;
      let escaped = false;
      let closed = false;
      offset += 1;

      while (offset < text.length) {
        const current = text[offset];
        if (escaped) {
          escaped = false;
          offset += 1;
          continue;
        }
        if (current === '\\') {
          escaped = true;
          offset += 1;
          continue;
        }
        if (current === quote) {
          offset += 1;
          closed = true;
          break;
        }
        if (current === '\n' && quote !== '`') {
          break;
        }
        offset += 1;
      }

      tokens.push({ kind: 'string', text: text.slice(start, offset), start, end: offset });
      if (!closed) {
        pushDiagnostic(diagnostics, document, start, offset, 'Unterminated string literal.');
      }
      continue;
    }

    if (isIdentifierStart(character)) {
      const start = offset;
      offset += 1;
      while (offset < text.length && isIdentifierPart(text[offset])) {
        offset += 1;
      }
      const value = text.slice(start, offset);
      tokens.push({
        kind: KEYWORDS.has(value) ? 'keyword' : 'identifier',
        text: value,
        start,
        end: offset,
      });
      continue;
    }

    if (/[0-9]/.test(character)) {
      const start = offset;
      offset += 1;
      while (offset < text.length && /[0-9._]/.test(text[offset])) {
        offset += 1;
      }
      tokens.push({ kind: 'number', text: text.slice(start, offset), start, end: offset });
      continue;
    }

    const operator = OPERATORS.find((candidate) => text.startsWith(candidate, offset));
    if (operator) {
      const start = offset;
      offset += operator.length;
      tokens.push({ kind: 'operator', text: operator, start, end: offset });
      continue;
    }

    const start = offset;
    offset += 1;
    tokens.push({
      kind: PUNCTUATION.has(character) ? 'punctuation' : 'unknown',
      text: character,
      start,
      end: offset,
    });
  }

  return { tokens, diagnostics };
}

function validateDelimiters(
  document: TextDocument,
  tokens: Token[],
  diagnostics: Diagnostic[],
): void {
  const stack: Token[] = [];

  for (const token of tokens) {
    if (token.kind !== 'punctuation') {
      continue;
    }
    if (OPEN_DELIMITERS[token.text]) {
      stack.push(token);
      continue;
    }
    if (!CLOSE_DELIMITERS.has(token.text)) {
      continue;
    }

    const opening = stack.pop();
    if (!opening) {
      pushDiagnostic(diagnostics, document, token.start, token.end, `Unexpected '${token.text}'.`);
      continue;
    }

    const expected = OPEN_DELIMITERS[opening.text];
    if (expected !== token.text) {
      pushDiagnostic(
        diagnostics,
        document,
        token.start,
        token.end,
        `Expected '${expected}' to close '${opening.text}', but found '${token.text}'.`,
      );
    }
  }

  for (const opening of stack.reverse()) {
    pushDiagnostic(
      diagnostics,
      document,
      opening.start,
      opening.end,
      `Unclosed '${opening.text}'. Expected '${OPEN_DELIMITERS[opening.text]}'.`,
    );
  }
}

function nextIdentifier(tokens: Token[], index: number): Token | undefined {
  const candidate = tokens[index + 1];
  return candidate?.kind === 'identifier' ? candidate : undefined;
}

function matchingDelimiter(tokens: Token[], openIndex: number): number | undefined {
  const opening = tokens[openIndex];
  const expected = OPEN_DELIMITERS[opening.text];
  if (!expected) {
    return undefined;
  }

  let depth = 0;
  for (let index = openIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.text === opening.text) {
      depth += 1;
    } else if (token.text === expected) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return undefined;
}

function addParameters(
  document: TextDocument,
  tokens: Token[],
  nameIndex: number,
  functionName: string,
  symbols: CoraSymbol[],
): void {
  const openIndex = tokens.findIndex(
    (token, index) => index > nameIndex && token.text === '(',
  );
  if (openIndex === -1) {
    return;
  }

  const closeIndex = matchingDelimiter(tokens, openIndex);
  if (closeIndex === undefined) {
    return;
  }

  let expectName = true;
  for (let index = openIndex + 1; index < closeIndex; index += 1) {
    const token = tokens[index];
    if (token.text === ',') {
      expectName = true;
      continue;
    }
    if (token.text === ':') {
      expectName = false;
      continue;
    }
    if (expectName && token.kind === 'identifier') {
      symbols.push({
        name: token.text,
        kind: SymbolKind.Variable,
        detail: `parameter of ${functionName}`,
        range: rangeFor(document, token.start, token.end),
        selectionRange: rangeFor(document, token.start, token.end),
        isParameter: true,
      });
      expectName = false;
    }
  }
}

function collectSymbols(document: TextDocument, tokens: Token[]): CoraSymbol[] {
  const symbols: CoraSymbol[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const keyword = tokens[index];
    if (keyword.kind !== 'keyword' || !DECLARATIONS[keyword.text]) {
      continue;
    }

    const declaration = DECLARATIONS[keyword.text];
    const name = nextIdentifier(tokens, index);
    if (!name) {
      continue;
    }

    symbols.push({
      name: name.text,
      kind: declaration.kind,
      detail: declaration.detail,
      range: rangeFor(document, keyword.start, name.end),
      selectionRange: rangeFor(document, name.start, name.end),
    });

    if (declaration.function) {
      addParameters(document, tokens, index + 1, name.text, symbols);
    }
  }

  return symbols;
}

export function analyze(document: TextDocument): Analysis {
  const scanned = scan(document);
  validateDelimiters(document, scanned.tokens, scanned.diagnostics);
  return {
    diagnostics: scanned.diagnostics,
    symbols: collectSymbols(document, scanned.tokens),
    tokens: scanned.tokens,
  };
}

export function documentSymbols(analysis: Analysis): DocumentSymbol[] {
  return analysis.symbols
    .filter((symbol) => !symbol.isParameter)
    .map((symbol) => ({
      name: symbol.name,
      detail: symbol.detail,
      kind: symbol.kind,
      range: symbol.range,
      selectionRange: symbol.selectionRange,
      children: [],
    }));
}

export function tokenAt(
  document: TextDocument,
  position: { line: number; character: number },
  tokens: Token[],
): Token | undefined {
  const offset = document.offsetAt(position);
  return tokens.find(
    (token) =>
      (token.kind === 'identifier' || token.kind === 'keyword' || token.kind === 'string') &&
      offset >= token.start &&
      offset <= token.end,
  );
}

export function symbolByName(symbols: CoraSymbol[], name: string): CoraSymbol | undefined {
  return symbols.find((symbol) => symbol.name === name);
}
