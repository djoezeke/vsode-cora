import { cp, copyFile, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverOutput = path.resolve(clientDirectory, '..', 'server', 'out');
const bundledOutput = path.resolve(clientDirectory, 'server', 'out');
const license = path.resolve(clientDirectory, '..', 'LICENSE');

await copyFile(license, path.join(clientDirectory, 'LICENSE'));

try {
  await access(serverOutput, constants.R_OK);
} catch {
  // The client can still be typechecked independently. The extension's
  // development fallback will use ../server/out when it exists.
  process.exit(0);
}

await mkdir(bundledOutput, { recursive: true });
await cp(serverOutput, bundledOutput, { recursive: true });
