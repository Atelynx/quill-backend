import { resolve } from 'node:path';

export function resolveEnvFilePaths(cwd = process.cwd()): string[] {
  return [
    resolve(cwd, '.env'),
    resolve(cwd, '.env.local'),
    resolve(cwd, '..', '.env'),
    resolve(cwd, '..', '.env.local'),
    resolve(cwd, '..', '..', '.env'),
    resolve(cwd, '..', '..', '.env.local'),
  ];
}
