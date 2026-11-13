import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './CasinoStage.css';

export type CasinoGame = 'roulette' | 'coinflip' | 'dice';
export type CasinoVisualResult = {
  outcome: string;
  won: boolean;
  net: number;
  payout_multiplier?: number;
  win_probability?: string;
};

const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const SEGMENT = 360 / WHEEL_ORDER.length;
const WHEEL_GRADIENT = `conic-gradient(${WHEEL_ORDER.map((number,index) => {
  const colour = number === 0 ? '#168653' : RED_NUMBERS.has(number) ? '#a72e45' : '#171923';
  return `${colour} ${index * SEGMENT}deg ${(index + 1) * SEGMENT}deg`;
}).join(',')})`;
const DICE_GLYPHS = ['','⚀','⚁','⚂','⚃','⚄','⚅'];

function resultNumber(outcome: string) {
  const parsed = Number.parseInt(outcome, 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 36 ? parsed : 0;
}

export default function CasinoStage({ game, result, animationKey, onAnimationComplete }: {
  game: CasinoGame;
  result: CasinoVisualResult | null;
  animationKey: number;
  onAnimationComplete?: () => void;
}) {
  const completionRef = useRef(onAnimationComplete);
  useEffect(() => { completionRef.current = onAnimationComplete; }, [onAnimationComplete]);
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState<CasinoVisualResult | null>(null);
  const number = result ? resultNumber(result.outcome) : 0;
  const wheelIndex = WHEEL_ORDER.indexOf(number);
  const targetRotation = 360 * 8 - Math.max(0, wheelIndex) * SEGMENT;
  const wheelStyle = useMemo(() => ({
    '--wheel-gradient': WHEEL_GRADIENT,
    '--target-rotation': `${targetRotation}deg`,
  }) as CSSProperties, [targetRotation]);

  useEffect(() => {
    if (!result || animationKey === 0) return;
    setRevealed(null);
    setRevealing(true);
    const duration = game === 'roulette' ? 4700 : 1900;
    const timer = window.setTimeout(() => {
      setRevealed(result);
      setRevealing(false);
      completionRef.current?.();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [animationKey, game, result]);

  const outcomeLabel = result?.outcome || 'Waiting for the next round';
  const coinSide = outcomeLabel.toLowerCase().includes('tails') ? 'TAILS' : 'HEADS';
  const dieNumber = Math.min(6, Math.max(1, Number.parseInt(outcomeLabel, 10) || 1));
  const wheelColour = number === 0 ? 'green' : RED_NUMBERS.has(number) ? 'red' : 'black';

  return (
    <section className="casino-stage" aria-label={game + ' game animation'}>
      <div className="casino-stage-topline">
        <span className="casino-live-dot" />
        <span>{revealing ? 'RESULT IN MOTION' : revealed ? 'ROUND COMPLETE' : 'TABLE READY'}</span>
        <span className="casino-stage-rule" />
        <small>{game === 'roulette' ? 'EUROPEAN · SINGLE ZERO' : game === 'coinflip' ? 'FAIR COIN · 50/50' : 'SIX-SIDED DIE'}</small>
      </div>

      {game === 'roulette' && (
        <div className="roulette-scene">
          <div className="roulette-pointer" />
          <div className={revealing ? 'roulette-wheel is-spinning' : 'roulette-wheel'} style={wheelStyle}>
            <div className="roulette-wheel-numbers" aria-hidden="true">
              {WHEEL_ORDER.map((value,index) => <span key={value} style={{ transform: `rotate(${index * SEGMENT + SEGMENT / 2}deg) translateY(-126px) rotate(-${index * SEGMENT + SEGMENT / 2}deg)` }}>{value}</span>)}
            </div>
            <div className="roulette-wheel-ring" />
            <div className="roulette-wheel-hub"><span>CHESS.GAY</span><strong>♛</strong></div>
          </div>
          <div className={revealing ? 'roulette-ball-track is-orbiting' : 'roulette-ball-track'}>
            <i className="roulette-ball" />
          </div>
          <div className="roulette-table-glow" />
        </div>
      )}

      {game === 'coinflip' && (
        <div className="coin-scene">
          <div className={revealing ? 'casino-coin is-flipping' : 'casino-coin'}>
            <div className="coin-face coin-front"><span>♛</span><b>HEADS</b></div>
            <div className="coin-face coin-back"><span>♞</span><b>TAILS</b></div>
          </div>
          <div className="coin-shadow" />
        </div>
      )}

      {game === 'dice' && (
        <div className="dice-scene">
          <div className={revealing ? 'casino-die is-rolling' : 'casino-die'}>{revealing ? '⚄' : DICE_GLYPHS[revealed ? dieNumber : 5]}</div>
          <div className="dice-shadow" />
        </div>
      )}

      <div className="casino-stage-result" aria-live="polite">
        {revealing ? (
          <><span className="stage-result-kicker">THE HOUSE IS WAITING</span><strong className="stage-result-wait">...</strong><small>Revealing the server-generated result</small></>
        ) : revealed ? (
          <>
            <span className="stage-result-kicker">{revealed.won ? 'LUCK FAVOURED YOU' : 'BETTER LUCK NEXT ROUND'}</span>
            <strong className={game === 'roulette' ? `stage-result-number ${wheelColour}` : 'stage-result-number'}>{game === 'roulette' ? number : game === 'coinflip' ? coinSide : dieNumber}</strong>
            <small>{game === 'roulette' ? wheelColour.toUpperCase() : game === 'coinflip' ? 'COIN FLIP' : dieNumber <= 3 ? 'LOW' : 'HIGH'}</small>
            <b className={revealed.net >= 0 ? 'stage-result-profit' : 'stage-result-loss'}>{revealed.net > 0 ? '+' : ''}{revealed.net.toLocaleString()} COINS</b>
          </>
        ) : (
          <><span className="stage-result-kicker">PLACE YOUR BET</span><strong className="stage-result-wait">READY?</strong><small>The result is generated securely by the server.</small></>
        )}
      </div>
    </section>
  );
}
