import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import './BoardWorkshop.css';

type BoardPreset = { id: string; name: string; light: string; dark: string };
const PALETTES: BoardPreset[] = [
  { id: 'moonstone', name: 'Moonstone', light: '#d9d4ef', dark: '#625b8e' },
  { id: 'sakura', name: 'Sakura', light: '#f5dce7', dark: '#b7658a' },
  { id: 'deep-sea', name: 'Deep Sea', light: '#b8e0e6', dark: '#28677d' },
  { id: 'forest', name: 'Forest', light: '#d7e3c2', dark: '#56744b' },
  { id: 'ember', name: 'Ember', light: '#f0d0a8', dark: '#92553f' },
  { id: 'slate', name: 'Slate', light: '#d4d8df', dark: '#626c7c' },
];
const STORAGE_KEY = 'chessgay:board-style';
const SAVED_KEY = 'chessgay:board-presets';
const PIECES = ['♜','♞','♝','♛','♚','♝','♞','♜','♟','♟','♟','♟','♟','♟','♟','♟','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','♙','♙','♙','♙','♙','♙','♙','♙','♖','♘','♗','♕','♔','♗','♘','♖'];

function applyBoard(light: string, dark: string) {
  document.documentElement.style.setProperty('--board-light', light);
  document.documentElement.style.setProperty('--board-dark', dark);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ light, dark })); } catch { /* storage may be disabled */ }
}

export default function BoardWorkshop({ onBack }: { onBack: () => void }) {
  const [light, setLight] = useState(PALETTES[0].light);
  const [dark, setDark] = useState(PALETTES[0].dark);
  const [name, setName] = useState('My board');
  const [saved, setSaved] = useState<BoardPreset[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    try {
      const active = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as { light?: string; dark?: string } | null;
      if (active?.light && active?.dark) { setLight(active.light); setDark(active.dark); applyBoard(active.light, active.dark); }
      const presets = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') as BoardPreset[];
      if (Array.isArray(presets)) setSaved(presets);
    } catch { /* ignore invalid local preferences */ }
  }, []);

  function equip(nextLight: string, nextDark: string) {
    setLight(nextLight); setDark(nextDark); applyBoard(nextLight, nextDark);
    setMessage('Board style equipped. It will be used in your local chess games on this device.');
  }

  function savePreset() {
    const preset: BoardPreset = { id: crypto.randomUUID(), name: name.trim().slice(0, 28) || 'My board', light, dark };
    const next = [preset, ...saved].slice(0, 12);
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); setMessage('Preset saved on this device.'); }
    catch { setMessage('Could not save this preset. Check your browser storage settings.'); }
  }

  function removePreset(id: string) {
    const next = saved.filter(item => item.id !== id);
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { setMessage('Could not update saved presets.'); }
  }

  return <section className="app-page board-workshop-page">
    <button className="back-link" onClick={onBack}>← BACK TO YOUR GAME ROOM</button>
    <div className="app-page-heading"><div className="eyebrow"><span className="eyebrow-line" /> THE BOARD WORKSHOP</div><h1>Build your <em>board.</em></h1><p>Choose your square colours, preview the result and equip a style for your local chess games.</p></div>
    <div className="workshop-layout">
      <div className="workshop-preview-card">
        <div className="workshop-card-heading"><div><span className="dashboard-kicker">LIVE PREVIEW</span><h2>Your board</h2></div><span className="workshop-mark">♞</span></div>
        <div className="workshop-board" style={{ '--board-light': light, '--board-dark': dark } as CSSProperties}>
          {PIECES.map((piece, index) => <div key={index} className={((Math.floor(index / 8) + index % 8) % 2 === 0) ? 'workshop-square light' : 'workshop-square dark'}>{piece && <span>{piece}</span>}</div>)}
        </div>
        <div className="workshop-colour-row"><span><i style={{ background: light }} /> LIGHT SQUARE</span><span><i style={{ background: dark }} /> DARK SQUARE</span></div>
      </div>
      <div className="workshop-controls">
        <div className="workshop-panel"><span className="dashboard-kicker">QUICK PALETTES</span><h2>Choose a mood</h2><div className="workshop-palette-grid">{PALETTES.map(palette => <button key={palette.id} className="workshop-palette" onClick={() => equip(palette.light, palette.dark)}><span><i style={{ background: palette.light }} /><i style={{ background: palette.dark }} /></span><strong>{palette.name}</strong></button>)}</div></div>
        <div className="workshop-panel"><span className="dashboard-kicker">CUSTOM COLOURS</span><h2>Fine tune it</h2><label className="workshop-colour-input">Light squares <input type="color" value={light} onChange={event => { setLight(event.target.value); setMessage(''); }} /></label><label className="workshop-colour-input">Dark squares <input type="color" value={dark} onChange={event => { setDark(event.target.value); setMessage(''); }} /></label><button className="workshop-primary" onClick={() => equip(light, dark)}>EQUIP BOARD STYLE</button></div>
        <div className="workshop-panel"><span className="dashboard-kicker">YOUR COLLECTION</span><h2>Save this design</h2><div className="workshop-save-row"><input value={name} maxLength={28} onChange={event => setName(event.target.value)} aria-label="Preset name" /><button onClick={savePreset}>SAVE</button></div><p className="workshop-note">Presets are currently stored in this browser. Cloud sync and sharing will arrive with account-backed customization.</p>{saved.map(preset => <div className="workshop-saved-item" key={preset.id}><button onClick={() => equip(preset.light, preset.dark)}><i style={{ background: preset.light }} /><i style={{ background: preset.dark }} /> <strong>{preset.name}</strong></button><button className="workshop-remove" onClick={() => removePreset(preset.id)} aria-label={'Delete '+preset.name}>×</button></div>)}</div>
      </div>
    </div>
    {message && <p className="workshop-message" role="status">{message}</p>}
    <p className="workshop-note">This first editor controls the board's two square colours. Custom piece sets, starting positions, variants and cross-device preset sync are separate upcoming features.</p>
  </section>;
}
