import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const checks = [
  ['App mounts the pixel-art theme backdrop', 'src/App.tsx', /<ThemeBackdrop\s*\/>/],
  ['App mounts the existing chess game', 'src/App.tsx', /page === 'chess' && <GamePage/],
  ['App mounts the existing casino experience', 'src/App.tsx', /<ArcadePage/],
  ['App retains the multiplayer lobby route', 'src/App.tsx', /page === 'lobby' && <MultiplayerLobby/],
  ['Theme backdrop retains Starry Void', 'src/components/ThemeBackdrop.tsx', /theme === 'starry'/],
  ['Theme backdrop retains Sakura', 'src/components/ThemeBackdrop.tsx', /theme === 'sakura'/],
  ['Theme backdrop retains Deep Sea', 'src/components/ThemeBackdrop.tsx', /theme === 'sea'/],
  ['Theme backdrop respects reduced motion', 'src/components/ThemeBackdrop.tsx', /prefers-reduced-motion/],
  ['Casino retains roulette, coinflip, dice and slots', 'src/components/ArcadePage.tsx', /roulette[\s\S]*coinflip[\s\S]*dice[\s\S]*slots/],
  ['Casino retains multiplayer tables', 'src/components/ArcadePage.tsx', /CasinoMultiplayer/],
  ['Casino retains its animated stage', 'src/components/ArcadePage.tsx', /CasinoStage/],
  ['Casino retains audio controls', 'src/components/ArcadePage.tsx', /primeCasinoAudio|setCasinoAmbience/],
  ['Chess rules engine remains present', 'src/lib/chess.ts', /getLegalMoves|legalMoves/],
  ['Authentication only creates anonymous guest sessions', 'src/components/AuthPanel.tsx', /signInAnonymously/],
  ['Email/password signup is removed', 'src/components/AuthPanel.tsx', /signUp\s*\(/],
  ['Email/password login is removed', 'src/components/AuthPanel.tsx', /signInWithPassword\s*\(/],
  ['Email password-reset flow is removed', 'src/components/AuthPanel.tsx', /resetPasswordForEmail\s*\(/],
  ['Email identity linking is removed', 'src/components/AuthPanel.tsx', /updateUser\s*\(\s*\{\s*email/],
];

const failures = [];
for (const [label, path, pattern, shouldExist = true] of checks) {
  const source = read(path);
  if (pattern.test(source) !== shouldExist) failures.push(label);
}

if (failures.length) {
  console.error('Platform preservation checks failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Platform preservation checks passed (${checks.length} safeguards).`);
}
