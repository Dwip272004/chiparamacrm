import { runSync, ORDER } from './sync.js';
import { runOutbox } from './outbox.js';

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const names = rest.filter((a) => !a.startsWith('--'));

for (const k of ['RECRUITCRM_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[k]) { console.error(`Missing ${k} (see ../.env.local)`); process.exit(1); }
}

try {
  if (cmd === 'sync') await runSync(names.length ? names : ORDER, { full: flags.has('--full') });
  else if (cmd === 'outbox') await runOutbox({ live: flags.has('--live') });
  else { console.log('usage: node src/cli.js sync [entity...] [--full] | outbox [--live]\nentities:', ORDER.join(', ')); process.exit(2); }
} catch (e) { console.error('Sync failed:', e.message); process.exit(1); }
