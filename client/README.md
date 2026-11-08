# Cora Language Support for VS Code

This package is the VS Code client for the Cora language server. The root
project builds the server first and copies its compiled entry point into this
extension so the extension can be packaged as a standalone VSIX.

Run `npm install` and then `npm run build` from the repository root. Open the
repository in VS Code and press `F5` to launch an Extension Development Host.

The server can be overridden for development with `cora.server.path` in VS
Code settings. The default is the server bundled by the build.
