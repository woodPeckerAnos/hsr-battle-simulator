#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import {
  evaluateCharacterDamage,
  runBattle,
} from './pipeline.js';
import type { BattleRequest, DamageEvalRequest } from './types.js';
import { validateBattleRequest } from './simulation/validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(): { installPath?: string; damage: boolean } {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      `Usage: npm run calc -- --install path/to/install.yaml [--damage]

  --install   YAML/JSON config (required)
  --damage    Evaluate single-hit damage for team.members[0] instead of battle sim
`,
    );
    process.exit(0);
  }
  const installIdx = args.indexOf('--install');
  return {
    installPath: installIdx >= 0 ? args[installIdx + 1] : undefined,
    damage: args.includes('--damage'),
  };
}

function loadConfig(path: string): BattleRequest {
  const raw = readFileSync(path, 'utf-8');
  return (
    path.endsWith('.yaml') || path.endsWith('.yml')
      ? (YAML.parse(raw) as BattleRequest)
      : (JSON.parse(raw) as BattleRequest)
  );
}

const { installPath, damage } = parseArgs();

try {
  if (!installPath) {
    throw new Error('--install is required');
  }

  const configPath = join(process.cwd(), installPath);
  const request = loadConfig(configPath);

  if (damage) {
    const build = request.team.members[0];
    if (!build) {
      throw new Error('team.members[0] is required for --damage');
    }
    const evalRequest: DamageEvalRequest = {
      build,
      enemyId: request.enemyId,
      skillId: build.skillId,
      enemyBroken: request.enemyBroken,
    };
    const result = evaluateCharacterDamage(
      evalRequest.build,
      evalRequest.enemyId,
      {
        skillId: evalRequest.skillId,
        enemyBroken: evalRequest.enemyBroken,
      },
    );
    console.log(JSON.stringify(result, null, 2));
  } else {
    validateBattleRequest(request);
    const result = runBattle(request);
    console.log(JSON.stringify(result, null, 2));
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
