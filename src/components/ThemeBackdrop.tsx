import { useEffect, useRef } from 'react';

type Theme = 'starry' | 'sakura' | 'sea';
type Star = { x: number; y: number; phase: number; size: number; tint: string };
type Petal = { x: number; y: number; speed: number; phase: number; size: number; color: string };
type Fish = { x: number; y: number; speed: number; direction: number; phase: number; palette: number };

const palettes = [
  { body: '#ff9f43', fin: '#ee5a24' },
  { body: '#48dbfb', fin: '#0abde3' },
  { body: '#feca57', fin: '#ff9f43' },
  { body: '#ff6b81', fin: '#ee5253' },
  { body: '#a29bfe', fin: '#6c5ce7' },
];

export default function ThemeBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const scale = 4;
    let width = 1;
    let height = 1;
    let theme: Theme = 'starry';
    let base: HTMLCanvasElement;
    let stars: Star[] = [];
    let petals: Petal[] = [];
    let fish: Fish[] = [];
    let bubbles: Array<{ x: number; y: number; speed: number; phase: number; size: number }> = [];
    let shooting: { x: number; y: number; life: number } | null = null;
    let frame = 0;
    let last = 0;
    let raf = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const random = (min: number, max: number) => min + Math.random() * (max - min);
    const pixel = (target: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) => {
      target.fillStyle = color;
      target.fillRect(Math.floor(x), Math.floor(y), w, h);
    };

    function build(nextTheme: Theme) {
      theme = nextTheme;
      width = Math.max(1, Math.ceil(window.innerWidth / scale));
      height = Math.max(1, Math.ceil(window.innerHeight / scale));
      canvas.width = width;
      canvas.height = height;
      base = document.createElement('canvas');
      base.width = width;
      base.height = height;
      const bg = base.getContext('2d');
      if (!bg) return;
      stars = [];
      petals = [];
      fish = [];
      bubbles = [];
      shooting = null;

      if (theme === 'starry') {
        pixel(bg, '#04050a', 0, 0, width, height);
        for (let i = 0; i < width * height / 90; i++) {
          stars.push({ x: random(0, width), y: random(0, height), phase: random(0, 6.3), size: Math.random() < .12 ? 2 : 1, tint: Math.random() < .2 ? '170,190,255' : '255,255,255' });
        }
      }

      if (theme === 'sakura') {
        const bands = ['#0b1030', '#131a44', '#1f2155', '#33295f', '#4e3366', '#7a4170'];
        bands.forEach((color, index) => pixel(bg, color, 0, height * index / bands.length, width, Math.ceil(height / bands.length) + 1));
        for (let i = 0; i < 60; i++) pixel(bg, 'rgba(255,255,255,.5)', random(0, width), random(0, height * .5));
        const moonX = Math.floor(width * .18);
        const moonY = Math.floor(height * .2);
        for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) if (x * x + y * y <= 49) pixel(bg, x * x + y * y > 38 ? '#ffe6ef' : '#fff6f9', moonX + x, moonY + y);
        pixel(bg, '#1a0f1f', 0, height - 6, width, 6);
        const trunkX = Math.floor(width * .78);
        const canopyY = Math.floor(height * .4);
        const radius = Math.floor(Math.min(width, height) * .28);
        for (let y = height - 6; y > canopyY + 4; y--) {
          const trunkWidth = y > height - 24 ? 6 : y > height - 56 ? 5 : 4;
          pixel(bg, '#3a2320', trunkX - trunkWidth / 2 + Math.round(Math.sin(y * .12) * 1.5), y, trunkWidth, 1);
        }
        for (let branch = 0; branch < 16; branch++) {
          const direction = branch % 2 ? 1 : -1;
          let x = trunkX;
          let y = canopyY + 8 + random(0, 30);
          const length = radius * random(.4, 1.1);
          for (let step = 0; step < length; step++) {
            pixel(bg, '#3a2320', x, y, 2, 2);
            x += direction * .9;
            y -= .5;
          }
        }
        const colors = ['#f6a8c3', '#e9789f', '#ffd3e1', '#c95b8a', '#f6a8c3'];
        for (let i = 0; i < 110; i++) {
          const angle = random(0, Math.PI * 2);
          const radiusFactor = Math.sqrt(Math.random());
          const x = trunkX + Math.cos(angle) * radius * 1.2 * radiusFactor;
          const y = canopyY + Math.sin(angle) * radius * .75 * radiusFactor;
          for (let k = 0; k < 28; k++) pixel(bg, colors[Math.floor(random(0, colors.length))], x + random(-5, 5), y + random(-4, 4));
        }
        for (let i = 0; i < width * height / 650 + 30; i++) petals.push({ x: random(-width, width), y: random(0, height), speed: random(.12, .32), phase: random(0, 6.3), size: Math.random() < .3 ? 2 : 1, color: colors[Math.floor(random(0, colors.length))] });
      }

      if (theme === 'sea') {
        const bands = ['#0b5078', '#0a4668', '#093c59', '#07324b', '#062a40', '#042234', '#031a29'];
        bands.forEach((color, index) => pixel(bg, color, 0, height * index / bands.length, width, Math.ceil(height / bands.length) + 1));
        for (let i = 0; i < 7; i++) {
          const startX = random(0, width);
          const beamWidth = 6 + random(0, 10);
          for (let y = 0; y < height * .8; y++) {
            bg.fillStyle = 'rgba(170,225,255,' + (.07 * (1 - y / (height * .8))).toFixed(3) + ')';
            bg.fillRect(Math.floor(startX + y * .35), y, beamWidth, 1);
          }
        }
        pixel(bg, '#10303a', 0, height - 5, width, 5);
        pixel(bg, '#173f4a', 0, height - 5, width, 1);
        for (let i = 0; i < 14; i++) {
          const x = random(0, width);
          const grassHeight = 8 + random(0, 16);
          for (let y = 0; y < grassHeight; y++) pixel(bg, i % 2 ? '#1f8a62' : '#18704f', x + Math.round(Math.sin(y * .5 + i) * 1.5), height - 5 - y);
        }
        for (let i = 0; i < 12; i++) fish.push({ x: random(0, width), y: random(8, height - 20), speed: random(.12, .4), direction: Math.random() < .5 ? 1 : -1, phase: random(0, 6.3), palette: i % palettes.length });
        for (let i = 0; i < 42; i++) bubbles.push({ x: random(0, width), y: random(0, height), speed: random(.1, .4), phase: random(0, 6.3), size: Math.random() < .25 ? 2 : 1 });
      }
    }

    function drawFish(target: CanvasRenderingContext2D, item: Fish, time: number) {
      const color = palettes[item.palette];
      const rows = ['..bbbb...', 'f.bbbbbb.', 'ffbbbbbeb', 'f.bbbbbb.', '..bbbb...'];
      const bob = Math.round(Math.sin(time * .002 + item.phase) * 2);
      rows.forEach((row, rowIndex) => {
        for (let column = 0; column < row.length; column++) {
          const character = row[column];
          if (character === '.') continue;
          const x = item.direction > 0 ? column : row.length - 1 - column;
          const shade = character === 'b' ? color.body : character === 'f' ? color.fin : '#fff';
          pixel(target, shade, item.x + x, item.y + bob + rowIndex);
        }
      });
    }

    function render(time: number) {
      if (!base) return;
      context.imageSmoothingEnabled = false;
      context.drawImage(base, 0, 0);
      if (theme === 'starry') {
        for (const star of stars) {
          const alpha = Math.round((.15 + .85 * Math.max(0, Math.sin(time * .001 * star.size + star.phase))) * 4) / 4;
          context.fillStyle = 'rgba(' + star.tint + ',' + alpha + ')';
          context.fillRect(star.x, star.y, star.size, star.size);
        }
        if (!shooting && Math.random() < .006) shooting = { x: random(width * .3, width), y: random(0, height * .35), life: 0 };
        if (shooting) {
          for (let i = 0; i < 9; i++) {
            context.fillStyle = 'rgba(255,255,255,' + ((1 - i / 9) * (1 - shooting.life / 45)).toFixed(2) + ')';
            context.fillRect(Math.floor(shooting.x + i * 1.6), Math.floor(shooting.y - i * .8), 1, 1);
          }
          shooting.x -= 1.8;
          shooting.y += .9;
          if (++shooting.life > 45) shooting = null;
        }
      }
      if (theme === 'sakura') {
        const gust = Math.pow(Math.max(0, Math.sin(time * .0004)), 6) * 1.4;
        for (let i = 0; i < petals.length; i++) {
          const petal = petals[i];
          petal.y += petal.speed + gust * .15;
          petal.x += .2 + gust * (.5 + petal.size * .25) + Math.sin(time * .002 + petal.phase) * .25;
          if (petal.y > height - 5 || petal.x > width + 4) petals[i] = { x: random(-width * .3, width), y: -2, speed: random(.12, .32), phase: random(0, 6.3), size: Math.random() < .3 ? 2 : 1, color: petal.color };
          const current = petals[i];
          pixel(context, current.color, current.x, current.y, current.size, current.size);
        }
      }
      if (theme === 'sea') {
        for (const bubble of bubbles) {
          bubble.y -= bubble.speed;
          bubble.x += Math.sin(time * .003 + bubble.phase) * .15;
          if (bubble.y < -2) { bubble.y = height; bubble.x = random(0, width); }
          pixel(context, 'rgba(200,235,255,.55)', bubble.x, bubble.y, bubble.size, bubble.size);
        }
        for (const swimmer of fish) {
          swimmer.x += swimmer.direction * swimmer.speed;
          if (swimmer.direction > 0 && swimmer.x > width + 12) { swimmer.x = -12; swimmer.y = random(8, height - 20); }
          if (swimmer.direction < 0 && swimmer.x < -12) { swimmer.x = width + 12; swimmer.y = random(8, height - 20); }
          drawFish(context, swimmer, time);
        }
      }
    }

    function loop(time: number) {
      if (!document.hidden && time - last > 32) { last = time; render(time); }
      raf = window.requestAnimationFrame(loop);
    }

    function setTheme(next: string | null) {
      const chosen: Theme = next === 'sakura' || next === 'sea' ? next : 'starry';
      build(chosen);
      window.cancelAnimationFrame(raf);
      if (reducedMotion.matches) render(0);
      else raf = window.requestAnimationFrame(loop);
    }

    const observer = new MutationObserver(() => setTheme(document.documentElement.dataset.theme));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const onResize = () => setTheme(theme);
    const onVisibility = () => { if (!document.hidden && !reducedMotion.matches) { window.cancelAnimationFrame(raf); raf = window.requestAnimationFrame(loop); } };
    const onMotionChange = () => setTheme(theme);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    reducedMotion.addEventListener('change', onMotionChange);
    setTheme(document.documentElement.dataset.theme);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onMotionChange);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="theme-backdrop" aria-hidden="true" />;
}
