# Cora language support for VS Code

This repository contains the VS Code client and the Language Server Protocol
server for Cora:

- `client/` is the VS Code extension. It registers `.cora` files and launches
  the server over Node IPC.
- `server/` contains the language server and the initial Cora analyzer.

## Development

Requirements: Node.js 18 or newer and VS Code 1.85 or newer.

```sh
npm install
npm run build
```

Open the repository in VS Code and press `F5` to launch an Extension
Development Host. Open a `.cora` file in that window to activate the client.

The current server provides diagnostics for unclosed delimiters and strings,
keyword and symbol completion, hover information, local definitions, document
symbols, and semantic tokens. Its analyzer is deliberately conservative while
the Cora grammar is being defined; add grammar rules in
`server/src/analyzer.ts` as the language specification grows.

Set `cora.server.path` to an absolute compiled server entry point when working
on a separate server build. Use the `Cora: Restart Language Server` command to
restart it after changing that build.

## Packaging

Run `npm run build` first. The client build copies `server/out` into the
extension directory so a VSIX packager can include the server and ship the
extension as a standalone package.
