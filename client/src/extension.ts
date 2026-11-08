import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { Trace } from 'vscode-jsonrpc';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

function resolveServerModule(context: vscode.ExtensionContext): string | undefined {
  const configuredPath = vscode.workspace
    .getConfiguration('cora')
    .get<string>('server.path')
    ?.trim();

  if (configuredPath) {
    return configuredPath;
  }

  const bundledPath = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // This fallback makes F5 development work before the copy step has run.
  const repositoryPath = path.resolve(context.extensionPath, '..', 'server', 'out', 'server.js');
  return fs.existsSync(repositoryPath) ? repositoryPath : undefined;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const serverModule = resolveServerModule(context);
  if (!serverModule) {
    void vscode.window.showErrorMessage(
      'Cora language support could not find the language server. Run `npm run build` or configure cora.server.path.',
    );
    return;
  }

  const run: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009'],
      },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'cora' }],
    synchronize: {
      configurationSection: 'cora',
    },
    outputChannelName: 'Cora Language Server',
  };

  client = new LanguageClient(
    'coraLanguageServer',
    'Cora Language Server',
    run,
    clientOptions,
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cora.restartLanguageServer', async () => {
      if (!client) {
        return;
      }

      await client.stop();
      await client.start();
    }),
  );
  context.subscriptions.push(client);

  const trace = vscode.workspace.getConfiguration('cora').get<'off' | 'messages' | 'verbose'>('trace.server', 'off');
  client.setTrace(Trace.fromString(trace));
  await client.start();
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
