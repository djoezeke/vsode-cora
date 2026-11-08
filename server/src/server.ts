import {
  CompletionItem,
  CompletionItemKind,
  createConnection,
  InitializeParams,
  InitializeResult,
  InsertTextFormat,
  Location,
  MarkupKind,
  ProposedFeatures,
  SemanticTokensBuilder,
  TextDocuments,
  TextDocumentSyncKind,
  SymbolKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  analyze,
  BUILTIN_DOCUMENTATION,
  CoraSymbol,
  documentSymbols,
  KEYWORD_DOCUMENTATION,
  symbolByName,
  Token,
  tokenAt,
} from './analyzer';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const semanticTokenTypes = [
  'comment',
  'keyword',
  'string',
  'number',
  'operator',
  'variable',
  'function',
  'type',
];

const semanticTokenLegend = {
  tokenTypes: semanticTokenTypes,
  tokenModifiers: [],
};

const typeSymbolKinds: SymbolKind[] = [
  SymbolKind.Class,
  SymbolKind.Enum,
  SymbolKind.Interface,
  SymbolKind.Namespace,
  SymbolKind.Struct,
  SymbolKind.TypeParameter,
];

let workspaceRoot: string | undefined;

connection.onInitialize((params: InitializeParams): InitializeResult => {
  workspaceRoot = params.rootUri ?? undefined;
  return {
    serverInfo: {
      name: 'Cora Language Server',
      version: '0.1.0',
    },
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['.', ':', '@'],
      },
      hoverProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      semanticTokensProvider: {
        legend: semanticTokenLegend,
        full: true,
      },
    },
  };
});

connection.onInitialized(() => {
  if (workspaceRoot) {
    connection.console.info(`Cora language server initialized for ${workspaceRoot}`);
  }
});

function validate(document: TextDocument): void {
  const analysis = analyze(document);
  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: analysis.diagnostics,
  });
}

documents.onDidOpen((event) => validate(event.document));
documents.onDidChangeContent((event) => validate(event.document));
documents.onDidClose((event) => {
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

function currentWord(document: TextDocument, position: { line: number; character: number }): string {
  const line = document.getText({
    start: { line: position.line, character: 0 },
    end: position,
  });
  const match = /[A-Za-z_][A-Za-z0-9_]*$/.exec(line);
  return match?.[0] ?? '';
}

function symbolCompletion(symbol: CoraSymbol): CompletionItem {
  const completionKinds: Partial<Record<SymbolKind, CompletionItemKind>> = {
    [SymbolKind.Class]: CompletionItemKind.Class,
    [SymbolKind.Constant]: CompletionItemKind.Constant,
    [SymbolKind.Enum]: CompletionItemKind.Enum,
    [SymbolKind.Function]: CompletionItemKind.Function,
    [SymbolKind.Interface]: CompletionItemKind.Interface,
    [SymbolKind.Namespace]: CompletionItemKind.Module,
    [SymbolKind.Struct]: CompletionItemKind.Struct,
    [SymbolKind.TypeParameter]: CompletionItemKind.TypeParameter,
    [SymbolKind.Variable]: CompletionItemKind.Variable,
  };
  return {
    label: symbol.name,
    kind: completionKinds[symbol.kind] ?? CompletionItemKind.Variable,
    detail: symbol.detail,
    sortText: `1-${symbol.name}`,
  };
}

connection.onCompletion((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const analysis = analyze(document);
  const prefix = currentWord(document, params.position).toLowerCase();
  const items: CompletionItem[] = [];

  for (const [name, documentation] of Object.entries(KEYWORD_DOCUMENTATION)) {
    if (!prefix || name.startsWith(prefix)) {
      items.push({
        label: name,
        kind: CompletionItemKind.Keyword,
        detail: 'Cora keyword',
        documentation: { kind: MarkupKind.Markdown, value: documentation },
        sortText: `2-${name}`,
      });
    }
  }

  for (const [name, documentation] of Object.entries(BUILTIN_DOCUMENTATION)) {
    if (!prefix || name.startsWith(prefix)) {
      items.push({
        label: name,
        kind: CompletionItemKind.Function,
        detail: 'Cora builtin',
        documentation: { kind: MarkupKind.Markdown, value: documentation },
        insertText: `${name}($0)`,
        insertTextFormat: InsertTextFormat.Snippet,
        sortText: `3-${name}`,
      });
    }
  }

  for (const symbol of analysis.symbols) {
    if (!prefix || symbol.name.toLowerCase().startsWith(prefix)) {
      items.push(symbolCompletion(symbol));
    }
  }

  return items;
});

connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return undefined;
  }

  const analysis = analyze(document);
  const token = tokenAt(document, params.position, analysis.tokens);
  if (!token) {
    return undefined;
  }

  const documentation =
    token.kind === 'keyword'
      ? KEYWORD_DOCUMENTATION[token.text]
      : BUILTIN_DOCUMENTATION[token.text];
  const symbol = token.kind === 'identifier' ? symbolByName(analysis.symbols, token.text) : undefined;
  const detail = symbol?.detail ?? documentation;
  if (!detail) {
    return undefined;
  }

  return {
    range: {
      start: document.positionAt(token.start),
      end: document.positionAt(token.end),
    },
    contents: {
      kind: MarkupKind.Markdown,
      value: symbol ? `**${symbol.name}**\n\n_${detail}_` : `**${token.text}**\n\n${detail}`,
    },
  };
});

connection.onDefinition((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const analysis = analyze(document);
  const token = tokenAt(document, params.position, analysis.tokens);
  if (!token || token.kind !== 'identifier') {
    return [];
  }

  const symbol = symbolByName(analysis.symbols, token.text);
  return symbol ? [Location.create(document.uri, symbol.selectionRange)] : [];
});

connection.onDocumentSymbol((params) => {
  const document = documents.get(params.textDocument.uri);
  return document ? documentSymbols(analyze(document)) : [];
});

function semanticTokenType(token: Token, symbols: CoraSymbol[]): string | undefined {
  switch (token.kind) {
    case 'comment':
      return 'comment';
    case 'keyword':
      return 'keyword';
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'operator':
      return 'operator';
    case 'identifier': {
      const symbol = symbolByName(symbols, token.text);
      if (symbol?.kind === SymbolKind.Function) {
        return 'function';
      }
      if (
        symbol &&
        typeSymbolKinds.includes(symbol.kind)
      ) {
        return 'type';
      }
      return 'variable';
    }
    default:
      return undefined;
  }
}

function pushMultilineToken(
  builder: SemanticTokensBuilder,
  document: TextDocument,
  token: Token,
  tokenType: string,
): void {
  const start = document.positionAt(token.start);
  const end = document.positionAt(token.end);
  const tokenTypeIndex = semanticTokenTypes.indexOf(tokenType);
  if (tokenTypeIndex < 0) {
    return;
  }

  if (start.line === end.line) {
    builder.push(start.line, start.character, Math.max(1, end.character - start.character), tokenTypeIndex, 0);
    return;
  }

  for (let line = start.line; line <= end.line; line += 1) {
    const lineText = document.getText({
      start: { line, character: 0 },
      end: { line: line + 1, character: 0 },
    });
    const lineStart = line === start.line ? start.character : 0;
    const lineEnd = line === end.line ? end.character : lineText.replace(/\r?\n$/, '').length;
    if (lineEnd > lineStart) {
      builder.push(line, lineStart, lineEnd - lineStart, tokenTypeIndex, 0);
    }
  }
}

connection.languages.semanticTokens.on((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return { data: [] };
  }

  const analysis = analyze(document);
  const builder = new SemanticTokensBuilder();
  for (const token of analysis.tokens) {
    const type = semanticTokenType(token, analysis.symbols);
    if (type) {
      pushMultilineToken(builder, document, token, type);
    }
  }
  return builder.build();
});

documents.listen(connection);
connection.listen();
