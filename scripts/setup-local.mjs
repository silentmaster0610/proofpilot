import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
if (!existsSync('.env')) {
  writeFileSync('.env', `# Private local keys. Never commit this file.\nPROOFPILOT_OWNER_KEY=${randomBytes(32).toString('hex')}\nPROOFPILOT_JUDGE_KEY=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
  console.log('Local access keys saved in ignored .env. Open it to copy your owner key.');
} else console.log('Existing .env preserved.');
if (!existsSync('.env.local')) writeFileSync('.env.local', '# Optional. Leave blank to use the sample without AI or cloud storage.\nNEBIUS_API_KEY=\nTURSO_DATABASE_URL=\nTURSO_AUTH_TOKEN=\n', { mode: 0o600 });
