import assert from 'node:assert/strict';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { analyze, documentSymbols } from '../out/analyzer.js';

const validDocument = TextDocument.create(
  'file:///valid.cora',
  'cora',
  1,
  `const answer = 42
fn greet(name) {
  print(name)
}`,
);
const validAnalysis = analyze(validDocument);

assert.deepEqual(validAnalysis.diagnostics, []);
assert.deepEqual(
  documentSymbols(validAnalysis).map((symbol) => symbol.name),
  ['answer', 'greet'],
);
assert.deepEqual(
  validAnalysis.symbols.filter((symbol) => symbol.isParameter).map((symbol) => symbol.name),
  ['name'],
);

const invalidDocument = TextDocument.create(
  'file:///invalid.cora',
  'cora',
  1,
  `fn broken(value) {
  print(value)
`,
);
const invalidAnalysis = analyze(invalidDocument);

assert.equal(invalidAnalysis.diagnostics.length, 1);
assert.match(invalidAnalysis.diagnostics[0].message, /Unclosed/);

console.log('Cora analyzer tests passed.');
