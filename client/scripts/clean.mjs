import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await rm(path.join(clientDirectory, 'out'), { recursive: true, force: true });
await rm(path.join(clientDirectory, 'server', 'out'), { recursive: true, force: true });
