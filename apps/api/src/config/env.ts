import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'test') {
  const localEnv = resolve(process.cwd(), '.env');
  const repositoryEnv = resolve(process.cwd(), '../../.env');
  dotenv.config({ path: existsSync(localEnv) ? localEnv : repositoryEnv });
}
