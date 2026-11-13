import { useState } from 'react';

const pieces = [
  ['♜','♞','♝','♛','♚','♝','♞','♜'],
  ['♟','♟','♟','♟','♟','♟','♟','♟'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['♙','♙','♙','♙','♙','♙','♙','♙'],
  ['♖','♘','♗','♕','♔','♗','♘','♖'],
];

const modes = [
  { number: '01', title: 'Chess', detail: 'Outplay a friend, challenge the crowd, or sharpen your game against an opponent that learns your style.', tag: 'THE MAIN EVENT', icon: '♞' },
  { number: '02', title: 'The Arcade', detail: 'Quick-fire games, high stakes in virtual coins, and a little chaos between matches.', tag: 'COMING INTO FOCUS', icon: '✳' },
  { number: '03', title: 'The Club', detail: 'Find your people. Private messages, group chats, rivalries, and late-night rematches.', tag: 'YOUR PEOPLE', icon: '♧' },
];

function Chessboard() {
  return (
    <div className="board-frame" aria-label="Decorative chessboard preview">
      <div className="board-topline"><span>POSITION Nº 001</span><span>WHITE TO MOVE</span></div>
      <div className="chessboard">
        {pieces.flatMap((row, r) => row.map((piece, c) => (
          <div className={`square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`} key={`${r}-${c}`}>
            {piece && <span className={r < 2 ? 'black-piece' : 'white-piece'}>{piece}</span>}
          </div>
        )))}
      </div>
      <div className="board-caption"><span>♜ &nbsp; EST. FOR THE LOVE OF THE GAME</span><span>64 SQUARES · INFINITE STORIES</span></div>
    </div>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <main>
      <div className="announcement"><span className="announcement-dot" /> THE CLUB IS TAKING SHAPE <span className="announcement-divider">/</span> A NEW KIND OF GAME ROOM</div>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="chess.gay home"><span className="brand-mark">♞</span><span>chess<span className="brand-dot">.</span>gay</span></a>
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? 'CLOSE' : 'MENU'} <span>☰</span></button>
        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          <a href="#games" onClick={() => setMenuOpen(false)}>THE GAMES</a>
          <a href="#community" onClick={() => setMenuOpen(false)}>THE CLUB</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>OUR STORY</a>
        </nav>
        <a className="header-cta" href="#games">EXPLORE <span>↗</span></a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> NOT JUST ANOTHER CHESS SITE</div>
          <h1>Your move.<br /><em>Your world.</em></h1>
          <p className="hero-lede">A little strategy. A little mischief. A place to play, compete, and find your people. Pull up a chair.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#games">EXPLORE THE GAMES <span>↗</span></a>
            <a className="text-link" href="#community">MEET THE CLUB <span>→</span></a>
          </div>
          <div className="hero-note"><span className="note-star">✳</span><span>BUILT FOR PLAYERS, NOT JUST PLAYING</span></div>
        </div>
        <div className="hero-art">
          <div className="art-glow" />
          <div className="art-stamp">THE<br />GAME<br />ROOM<span>✳</span></div>
          <Chessboard />
          <div className="side-note">THINK<br />AHEAD.</div>
        </div>
        <div className="hero-bottomline"><span>01 — A PLACE TO PLAY</span><span>MADE FOR THE CURIOUS</span><span>SCROLL TO EXPLORE ↓</span></div>
      </section>

      <section className="ticker" aria-label="Platform values">
        <div>PLAY WITH PURPOSE <b>✳</b> STAY FOR THE PEOPLE <b>✳</b> MAKE YOUR NEXT MOVE <b>✳</b> PLAY WITH PURPOSE <b>✳</b> STAY FOR THE PEOPLE <b>✳</b></div>
      </section>

      <section className="games-section section-pad" id="games">
        <div className="section-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> THE LINEUP</div><h2>Choose your<br /><em>kind of trouble.</em></h2></div>
          <p>One home for thoughtful games, ridiculous comebacks, and the people you'll want to play again.</p>
        </div>
        <div className="mode-grid">
          {modes.map((mode) => (
            <article className="mode-card" key={mode.number}>
              <div className="mode-card-top"><span>{mode.number} / 03</span><span className="mode-icon">{mode.icon}</span></div>
              <div className="mode-card-bottom"><div className="mode-tag">{mode.tag}</div><h3>{mode.title}</h3><p>{mode.detail}</p><a href="#community" className="card-link">TAKE A LOOK <span>↗</span></a></div>
            </article>
          ))}
        </div>
      </section>

      <section className="community-section section-pad" id="community">
        <div className="community-ornament">♘</div>
        <div className="community-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> BETTER TOGETHER</div>
          <h2>Good games.<br /><em>Better company.</em></h2>
          <p>Challenge your friends, start a group chat, talk your way through a close match, and keep the conversation going without leaving the board.</p>
          <div className="community-points"><span>✳ PRIVATE CONVERSATIONS</span><span>✳ GROUP CHATS</span><span>✳ IN-GAME MESSAGES</span></div>
        </div>
        <div className="chat-preview">
          <div className="chat-head"><span className="chat-avatar">♟</span><div><strong>The usual suspects</strong><small>GROUP CHAT · 4 MEMBERS</small></div><span className="chat-menu">•••</span></div>
          <div className="chat-body"><div className="chat-date">TODAY · 20:41</div><div className="bubble bubble-them"><small>mossyrook</small> rematch. no excuses this time</div><div className="bubble bubble-you">you say that every time <span>✓✓</span></div><div className="bubble bubble-them"><small>bishopenergy</small> i'm just here for the drama</div></div>
          <div className="chat-input"><span>Message the group…</span><b>↗</b></div>
          <div className="preview-disclaimer">ILLUSTRATIVE PREVIEW · CHAT IS NOT LIVE YET</div>
        </div>
      </section>

      <section className="manifesto section-pad" id="about">
        <div className="manifesto-number">A NOTE FROM THE HOUSE</div>
        <p>Not every game needs to be serious.<br />But every player deserves a place<br />where <em>the game feels alive.</em></p>
        <span className="manifesto-flourish">✳</span>
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top"><span className="brand-mark">♞</span><span>chess<span className="brand-dot">.</span>gay</span></a>
        <span className="footer-note">A WORK IN PROGRESS. A WORLD IN THE MAKING.</span>
        <a className="back-top" href="#top">BACK TO TOP ↑</a>
        <div className="footer-bottom"><span>© 2026 CHESS.GAY</span><span>PLAY NICE. THINK SHARP.</span><span>BUILT ONE MOVE AT A TIME.</span></div>
      </footer>
    </main>
  );
}