# Cora Language Server

The server speaks LSP over Node IPC and is launched by the VS Code client. It
currently provides diagnostics for malformed delimiters and strings,
completion, hover, local definition lookup, document symbols, and semantic
tokens.

The analyzer intentionally accepts a small, conservative Cora surface while
the language grammar is still being established. Recognized declarations are
`let`, `const`, `var`, `fn`, `function`, `func`, `type`, `struct`, `enum`,
`trait`, `class`, and `module`.
