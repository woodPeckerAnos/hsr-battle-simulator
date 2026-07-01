#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { runPipeline } from './pipeline.js';
import type { BuildRequest } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(): { installPath?: string; mode?: string } {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: npm run calc -- [--install path/to/install.yaml] [--mode single_hit|timeline|combat]`);
    process.exit(0);
  }
  const installIdx = args.indexOf('--install');
  const modeIdx = args.indexOf('--mode');
  return {
    installPath: installIdx >= 0 ? args[installIdx + 1] : undefined,
    mode: modeIdx >= 0 ? args[modeIdx + 1] : undefined,
  };
}

function loadInstall(path: string): BuildRequest {
  const raw = readFileSync(path, 'utf-8');
  const data = path.endsWith('.yaml') || path.endsWith('.yml')
    ? (YAML.parse(raw) as BuildRequest)
    : (JSON.parse(raw) as BuildRequest);
  return data;
}

function defaultRequest(mode: string): BuildRequest {
  return {
    mode: mode as BuildRequest['mode'],
    enemyId: 'foi-95',
    enemyBroken: false,
    team: {
      members: [
        {
          characterId: 'jingliu',
          skillId: 'basic',
          statOverrides: { atkPercent: 0, flatAtk: 970 },
        },
      ],
    },
  };
}

const { installPath, mode } = parseArgs();
const defaultMode = mode ?? 'single_hit';

try {
  const request = installPath
    ? loadInstall(installPath)
    : defaultRequest(defaultMode);

  if (mode) request.mode = mode as BuildRequest['mode'];

  const result = runPipeline(request);
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
