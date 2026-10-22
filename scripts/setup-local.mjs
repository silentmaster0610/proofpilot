import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
if (!existsSync('.env')) {
  writeFileSync('.env', `# Private local keys. Never commit this file.\nPROOFPILOT_OWNER_KEY=${randomBytes(32).toString('hex')}\nPROOFPILOT_JUDGE_KEY=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
  console.log('Local setup is ready. Open /login and create an account with an 8-character-or-longer password. Optional legacy keys are saved in ignored .env.');
} else console.log('Existing .env preserved.');
if (!existsSync('.env.local')) writeFileSync('.env.local', '# Optional. Leave blank to use the sample without AI or cloud storage.\nNEBIUS_API_KEY=\nTURSO_DATABASE_URL=\nTURSO_AUTH_TOKEN=\n', { mode: 0o600 });
