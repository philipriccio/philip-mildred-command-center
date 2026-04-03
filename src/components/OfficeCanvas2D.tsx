import { useEffect, useRef, useState } from 'react';

export interface OfficeAgent {
  id: string;
  name: string;
  state: 'working' | 'blocked' | 'idle' | 'offline' | 'finished' | 'reserved';
  taskTitle: string | null;
  color: string;
}

interface OfficeCanvas2DProps {
  agents: OfficeAgent[];
  onSelectAgent?: (agentId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 1100;
const H = 720;
const FLOOR_TILE = 32;
const WALK_SPEED = 90; // px/sec

// Colors — Company Theatre palette
const C = {
  floorA: '#0f172a',
  floorB: '#131e2e',
  wall: '#1e293b',
  wallBorder: '#334155',
  roomFill: '#0d1929',
  roomBorder: '#1e3a5f',
  desk: '#1e3a2f',
  deskBorder: '#2d5a40',
  monitor: '#0ea5e9',
  monitorScreen: '#172554',
  chair: '#374151',
  lounge: '#1a1a2e',
  door: '#d97706',
  text: '#94a3b8',
  textBright: '#e2e8f0',
  statusBar: '#0a0f1e',
  statusBorder: '#1e293b',
  ctRed: '#b91c1c',        // Company Theatre red
  ctGold: '#fbbf24',       // accent gold
  spotlightYellow: '#fde68a',
  curtainRed: '#7f1d1d',
};

// ─── Room / furniture layout ──────────────────────────────────────────────────
const ROOMS = {
  conference: { x: 20, y: 20, w: 210, h: 140, label: 'The Green Room' },
  philipOffice: { x: 250, y: 20, w: 210, h: 140, label: "Philip's Office" },
  kitchen:      { x: 480, y: 20, w: 180, h: 140, label: 'Kitchen' },
  lounge:       { x: 900, y: 170, w: 180, h: 380, label: 'Backstage' },
};

const DOOR = { x: W / 2 - 20, y: 665, w: 40, h: 14 };

// Desk positions (center of chair position)
const DESKS: Record<string, { x: number; y: number; deskX: number; deskY: number; label: string }> = {
  main:      { x: 160, y: 490, deskX: 120, deskY: 430, label: 'Mildred' },
  dev:       { x: 400, y: 400, deskX: 360, deskY: 340, label: 'Dev' },
  janet:     { x: 160, y: 600, deskX: 120, deskY: 545, label: 'Janet' },
  kimi:      { x: 400, y: 600, deskX: 360, deskY: 545, label: 'Kimi' },
  'gpt-mini':{ x: 280, y: 300, deskX: 240, deskY: 240, label: 'GPT-mini' },
};

// Waypoints
const WP = {
  door:    { x: W / 2, y: 640 },
  hub:     { x: W / 2, y: 500 },
  hubLeft: { x: 300, y: 500 },
  kitchen: { x: 560, y: 100 },
  lounge:  { x: 940, y: 380 },
};

// Agent personality icons
const AGENT_ICONS: Record<string, string> = {
  main: '🎧',        // Mildred — headset (chief of staff)
  dev: '{ }',        // Dev — code brackets
  janet: '✉️',       // Janet — envelope (email)
  kimi: '🌙',        // Kimi — crescent moon (Moonshot)
  'gpt-mini': '⚡',  // GPT-mini — lightning bolt (fast)
};

// ─── Agent runtime state ──────────────────────────────────────────────────────
interface Vec2 { x: number; y: number }

type AgentPhase =
  | 'entering'   // walking door → hub → desk
  | 'sitting'    // at desk, typing
  | 'wandering'  // idle: roaming
  | 'exiting'    // walking desk → door → gone
  | 'gone';      // not visible

interface AgentRuntime {
  id: string;
  name: string;
  color: string;
  state: OfficeAgent['state'];
  pos: Vec2;
  phase: AgentPhase;
  path: Vec2[];          // remaining waypoints to walk
  animFrame: number;     // 0 or 1 for walk cycle
  animTimer: number;     // seconds since last frame flip
  sittingTimer: number;  // typing animation tick
  wanderTimer: number;   // time until next wander dest
  lingerTimer: number;   // seconds to linger at desk after going idle (0 = leave now)
  visible: boolean;
}

function makeRuntime(agent: OfficeAgent): AgentRuntime {
  const phase = stateToPhase(agent.state);
  const desk = DESKS[agent.id];
  const startPos = phase === 'sitting' && desk
    ? { x: desk.x, y: desk.y }
    : { ...WP.door };

  return {
    id: agent.id,
    name: agent.name,
    color: agent.color,
    state: agent.state,
    pos: { ...startPos },
    phase,
    path: phase === 'entering' && desk ? buildPath(WP.door, desk) : [],
    animFrame: 0,
    animTimer: 0,
    sittingTimer: 0,
    wanderTimer: 0,
    lingerTimer: 0,
    visible: phase !== 'gone',
  };
}

function stateToPhase(state: OfficeAgent['state']): AgentPhase {
  if (state === 'working' || state === 'blocked') return 'entering';
  // idle, finished, offline, reserved → not in the room
  return 'gone';
}

function buildPath(from: Vec2, desk: { x: number; y: number }): Vec2[] {
  // Simple path through hub
  return [{ ...WP.hub }, { x: desk.x, y: desk.y }];
}

function dist(a: Vec2, b: Vec2) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ─── Update ───────────────────────────────────────────────────────────────────
function updateAgent(r: AgentRuntime, dt: number) {
  r.animTimer += dt;
  if (r.animTimer > 0.18) {
    r.animTimer = 0;
    r.animFrame = 1 - r.animFrame;
  }

  if (r.phase === 'sitting') {
    r.sittingTimer += dt;
    // If lingering (idle at desk), count down before leaving
    if (r.lingerTimer > 0) {
      r.lingerTimer -= dt;
      if (r.lingerTimer <= 0) {
        r.lingerTimer = 0;
        const desk = DESKS[r.id];
        if (desk) {
          r.phase = 'exiting';
          r.path = [{ ...WP.hub }, { ...WP.door }];
        }
      }
    }
    return;
  }

  if (r.phase === 'wandering') {
    r.wanderTimer -= dt;
    if (r.wanderTimer <= 0) {
      // Pick a new wander destination
      const dests = [WP.kitchen, WP.lounge, WP.hub];
      const dest = dests[Math.floor(Math.random() * dests.length)];
      r.path = [dest];
      r.wanderTimer = 4 + Math.random() * 5;
    }
  }

  // Walk along path
  if (r.path.length > 0) {
    const target = r.path[0];
    const d = dist(r.pos, target);
    const step = WALK_SPEED * dt;

    if (d <= step) {
      r.pos = { ...target };
      r.path.shift();

      if (r.path.length === 0) {
        if (r.phase === 'entering') {
          r.phase = 'sitting';
        } else if (r.phase === 'exiting') {
          r.phase = 'gone';
          r.visible = false;
        }
      }
    } else {
      const ratio = step / d;
      r.pos.x = lerp(r.pos.x, target.x, ratio);
      r.pos.y = lerp(r.pos.y, target.y, ratio);
    }
  }
}

const LINGER_SECONDS = 120; // Stay at desk 2 minutes after going idle

function syncState(r: AgentRuntime, newState: OfficeAgent['state']) {
  if (r.state === newState) return;
  r.state = newState;
  const desk = DESKS[r.id];

  if (newState === 'working' || newState === 'blocked') {
    // Agent starts working → cancel any linger countdown, sit at desk
    r.lingerTimer = 0;
    if (r.phase !== 'sitting' && r.phase !== 'entering') {
      r.phase = 'entering';
      r.pos = { ...WP.door };
      r.visible = true;
      r.path = desk ? buildPath(WP.door, desk) : [];
    }
    // If they were lingering at desk (idle→working again), just stay seated
    if (r.phase === 'sitting') {
      // Already there, just keep sitting — linger cleared above
    }
  } else {
    // Agent stops working (idle, finished, offline)
    if (r.phase === 'sitting') {
      // Don't leave immediately — linger at desk for a while
      r.lingerTimer = LINGER_SECONDS;
    } else if (r.phase === 'entering') {
      // Was walking in — let them arrive, then linger
      r.lingerTimer = LINGER_SECONDS;
    } else if (r.phase === 'wandering') {
      r.phase = 'exiting';
      r.path = [{ ...WP.hub }, { ...WP.door }];
    } else if (r.phase === 'gone') {
      r.visible = false;
    }
  }
}

// ─── Render helpers ───────────────────────────────────────────────────────────
function drawFloor(ctx: CanvasRenderingContext2D) {
  for (let row = 0; row * FLOOR_TILE < H - 50; row++) {
    for (let col = 0; col * FLOOR_TILE < W; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? C.floorA : C.floorB;
      ctx.fillRect(col * FLOOR_TILE, row * FLOOR_TILE, FLOOR_TILE, FLOOR_TILE);
    }
  }

  // CT logo watermark on the floor (center of workspace area)
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = C.ctRed;
  ctx.font = 'bold 120px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CT', W / 2, 520);
  ctx.restore();

  // Stage curtain valance at the very top
  ctx.fillStyle = C.curtainRed;
  ctx.fillRect(0, 0, W, 6);
  ctx.fillStyle = '#5a1515';
  // Scalloped edge
  for (let i = 0; i < W / 20; i++) {
    ctx.beginPath();
    ctx.arc(i * 20 + 10, 6, 8, 0, Math.PI, false);
    ctx.fill();
  }
  // Gold trim
  ctx.fillStyle = 'rgba(251,191,36,0.3)';
  ctx.fillRect(0, 0, W, 2);
}

function drawRoom(ctx: CanvasRenderingContext2D, room: typeof ROOMS.conference) {
  ctx.fillStyle = C.roomFill;
  ctx.fillRect(room.x, room.y, room.w, room.h);
  ctx.strokeStyle = C.roomBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(room.x, room.y, room.w, room.h);
  ctx.fillStyle = C.textBright;
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(room.label, room.x + room.w / 2, room.y + 16);
}

function drawDesk(ctx: CanvasRenderingContext2D, d: typeof DESKS.mildred) {
  // Desk surface
  ctx.fillStyle = C.desk;
  ctx.fillRect(d.deskX, d.deskY, 80, 50);
  ctx.strokeStyle = C.deskBorder;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(d.deskX, d.deskY, 80, 50);

  // Monitor
  ctx.fillStyle = C.monitor;
  ctx.fillRect(d.deskX + 22, d.deskY - 28, 36, 26);
  ctx.fillStyle = C.monitorScreen;
  ctx.fillRect(d.deskX + 25, d.deskY - 25, 30, 20);
  // Monitor stand
  ctx.fillStyle = C.monitor;
  ctx.fillRect(d.deskX + 37, d.deskY - 2, 6, 4);

  // Chair
  ctx.fillStyle = C.chair;
  ctx.fillRect(d.x - 12, d.y - 8, 24, 20);

  // Name plate
  ctx.fillStyle = C.text;
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(d.label, d.deskX + 40, d.deskY + 65);
}

function drawDoor(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.door;
  ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  ctx.fillStyle = C.textBright;
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('🎭 STAGE DOOR', DOOR.x + DOOR.w / 2, DOOR.y - 4);
}

function drawLounge(ctx: CanvasRenderingContext2D) {
  const r = ROOMS.lounge;
  ctx.fillStyle = '#1a0a0a';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#4d1a1a';
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);

  // Curtain drapes on left and right walls
  for (let i = 0; i < 12; i++) {
    const wave = Math.sin(i * 0.8) * 3;
    ctx.fillStyle = i % 2 === 0 ? C.curtainRed : '#5a1515';
    ctx.fillRect(r.x + 2 + wave, r.y + 20 + i * 30, 12, 30);
    ctx.fillRect(r.x + r.w - 14 + wave, r.y + 20 + i * 30, 12, 30);
  }

  ctx.fillStyle = C.ctGold;
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(r.label, r.x + r.w / 2, r.y + 16);

  // Star on the door
  ctx.font = '14px sans-serif';
  ctx.fillText('⭐', r.x + r.w / 2 - 7, r.y + 34);

  // Vintage couch (velvet red)
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(r.x + 20, r.y + 50, 140, 45);
  ctx.fillStyle = '#991b1b';
  ctx.fillRect(r.x + 22, r.y + 52, 136, 20); // cushion highlight

  // Coffee table with scripts
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(r.x + 40, r.y + 110, 80, 35);
  // Scripts on the table
  ctx.fillStyle = '#f5f0e0';
  ctx.fillRect(r.x + 50, r.y + 118, 16, 22);
  ctx.fillRect(r.x + 70, r.y + 116, 16, 22);
  ctx.fillStyle = '#94a3b8';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(r.x + 52, r.y + 122 + i * 5, 12, 1);
  }

  // Props rack (costumes/hats)
  ctx.fillStyle = '#374151';
  ctx.fillRect(r.x + 25, r.y + 160, 130, 4); // rack bar
  ctx.fillRect(r.x + 30, r.y + 160, 3, 30);   // left post
  ctx.fillRect(r.x + 152, r.y + 160, 3, 30);  // right post
  // Hanging costumes
  const costumeColors = ['#dc2626', '#2563eb', '#15803d', '#7c3aed', C.ctGold];
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = costumeColors[i];
    ctx.fillRect(r.x + 40 + i * 24, r.y + 165, 14, 24);
  }

  // Prop trunk
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(r.x + 30, r.y + 220, 80, 40);
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 30, r.y + 220, 80, 40);
  ctx.fillStyle = C.ctGold;
  ctx.fillRect(r.x + 65, r.y + 235, 10, 10); // latch

  // Theatre masks on the wall — 🎭
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎭', r.x + r.w / 2, r.y + 300);

  // "THE COMPANY THEATRE" small plaque
  ctx.fillStyle = C.ctRed;
  ctx.fillRect(r.x + 20, r.y + r.h - 40, 140, 22);
  ctx.fillStyle = C.ctGold;
  ctx.font = 'bold 8px "JetBrains Mono", monospace';
  ctx.fillText('THE COMPANY THEATRE', r.x + r.w / 2, r.y + r.h - 25);
}

function drawConferenceRoom(ctx: CanvasRenderingContext2D) {
  const r = ROOMS.conference;
  // Dark backstage-green walls
  ctx.fillStyle = '#0a1a14';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#2d5a40';
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = C.ctGold;
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(r.label, r.x + r.w / 2, r.y + 16);

  // Vanity mirror (long rectangle on back wall)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(r.x + 30, r.y + 28, 150, 40);
  ctx.strokeStyle = C.ctGold;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x + 30, r.y + 28, 150, 40);
  // Mirror reflection shimmer
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(r.x + 35, r.y + 32, 60, 32);

  // Vanity light bulbs across the top of the mirror
  for (let i = 0; i < 7; i++) {
    const bx = r.x + 42 + i * 22;
    const by = r.y + 24;
    ctx.fillStyle = C.spotlightYellow;
    ctx.beginPath();
    ctx.arc(bx, by, 4, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    ctx.fillStyle = 'rgba(253,230,138,0.15)';
    ctx.beginPath();
    ctx.arc(bx, by, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Makeup counter / shelf below mirror
  ctx.fillStyle = '#1a3d2a';
  ctx.fillRect(r.x + 30, r.y + 70, 150, 15);

  // Directors chairs (classic X-frame style)
  for (let i = 0; i < 3; i++) {
    const cx = r.x + 55 + i * 50;
    const cy = r.y + 110;
    // Chair back (canvas fabric)
    ctx.fillStyle = C.ctRed;
    ctx.fillRect(cx - 10, cy - 12, 20, 8);
    // Frame (X shape simplified)
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 4);
    ctx.lineTo(cx + 8, cy + 12);
    ctx.moveTo(cx + 8, cy - 4);
    ctx.lineTo(cx - 8, cy + 12);
    ctx.stroke();
    // Seat
    ctx.fillStyle = C.ctRed;
    ctx.fillRect(cx - 8, cy + 2, 16, 5);
  }

  // Theatre masks on right wall — 🎭
  ctx.font = '20px sans-serif';
  ctx.fillText('🎭', r.x + r.w - 30, r.y + 90);
}

function drawPhilipOffice(ctx: CanvasRenderingContext2D) {
  const r = ROOMS.philipOffice;
  // Deep red accent wall
  ctx.fillStyle = '#1a0a0a';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // Red accent on back wall
  ctx.fillStyle = C.curtainRed;
  ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, 20);
  ctx.strokeStyle = '#4d1a1a';
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = C.ctGold;
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText("Philip's Office", r.x + r.w / 2, r.y + 16);

  // Executive desk (dark mahogany)
  ctx.fillStyle = '#2d1a0a';
  ctx.fillRect(r.x + 40, r.y + 40, 130, 60);
  ctx.strokeStyle = '#5a3a1a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x + 40, r.y + 40, 130, 60);

  // Scripts/papers on desk
  ctx.fillStyle = '#f5f0e0';
  ctx.fillRect(r.x + 50, r.y + 50, 24, 32);
  ctx.fillRect(r.x + 78, r.y + 48, 24, 32);
  // Script text lines
  ctx.fillStyle = '#94a3b8';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(r.x + 53, r.y + 55 + i * 6, 18, 1);
    ctx.fillRect(r.x + 81, r.y + 53 + i * 6, 18, 1);
  }
  // Red pen
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(r.x + 108, r.y + 55, 3, 20);

  // Spotlight lamp (floor standing, left side)
  ctx.fillStyle = '#374151';
  ctx.fillRect(r.x + 14, r.y + 90, 4, 40);     // Stand
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(r.x + 10, r.y + 130, 12, 4);     // Base
  ctx.fillStyle = C.spotlightYellow;
  ctx.beginPath();
  ctx.moveTo(r.x + 8, r.y + 90);
  ctx.lineTo(r.x + 24, r.y + 90);
  ctx.lineTo(r.x + 16, r.y + 78);
  ctx.closePath();
  ctx.fill();
  // Spotlight glow
  ctx.fillStyle = 'rgba(253,230,138,0.08)';
  ctx.beginPath();
  ctx.arc(r.x + 16, r.y + 86, 20, 0, Math.PI * 2);
  ctx.fill();

  // Director's chair (right side)
  const cx = r.x + r.w - 40;
  const cy = r.y + 100;
  ctx.fillStyle = C.ctRed;
  ctx.fillRect(cx - 12, cy - 14, 24, 8);         // Back canvas
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 6);
  ctx.lineTo(cx + 10, cy + 14);
  ctx.moveTo(cx + 10, cy - 6);
  ctx.lineTo(cx - 10, cy + 14);
  ctx.stroke();
  ctx.fillStyle = C.ctRed;
  ctx.fillRect(cx - 10, cy + 2, 20, 5);           // Seat

  // Star on the door ⭐
  ctx.font = '14px sans-serif';
  ctx.fillText('⭐', r.x + r.w / 2 - 7, r.y + r.h - 8);
}

function drawKitchen(ctx: CanvasRenderingContext2D) {
  const r = ROOMS.kitchen;
  ctx.fillStyle = '#0d1a14';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = C.roomBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = C.textBright;
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Kitchen', r.x + r.w / 2, r.y + 16);
  // Counter
  ctx.fillStyle = '#1e3d2a';
  ctx.fillRect(r.x + 10, r.y + 25, r.w - 20, 30);
  // Fridge
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(r.x + 15, r.y + 60, 36, 70);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(r.x + 17, r.y + 62, 14, 30);
  ctx.fillRect(r.x + 17, r.y + 96, 14, 30);
  // Coffee machine
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(r.x + 100, r.y + 60, 50, 55);
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(r.x + 125, r.y + 80, 12, 0, Math.PI * 2);
  ctx.fill();
  // "BREAK A LEG" sign on the wall
  ctx.fillStyle = C.ctRed;
  ctx.fillRect(r.x + 60, r.y + 120, 110, 18);
  ctx.fillStyle = C.ctGold;
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BREAK A LEG ☕', r.x + 115, r.y + 133);
}

function drawPlants(ctx: CanvasRenderingContext2D) {
  const positions = [
    { x: 870, y: 170 }, { x: 870, y: 540 }, { x: 665, y: 170 },
    { x: 20, y: 170 }, { x: 680, y: 640 },
  ];
  for (const p of positions) {
    // Pot
    ctx.fillStyle = '#92400e';
    ctx.fillRect(p.x - 8, p.y + 10, 16, 12);
    // Plant
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(p.x - 8, p.y + 4, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x + 8, p.y + 4, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  r: AgentRuntime,
  sitting: boolean,
) {
  const { x, y } = r.pos;
  const scale = 2;
  const frame = r.animFrame;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 18 * scale, 10 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (sitting) {
    // Sitting: legs forward, arms extended
    // Legs (tucked under desk)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 6 * scale, y + 4 * scale, 5 * scale, 6 * scale);
    ctx.fillRect(x + 1 * scale, y + 4 * scale, 5 * scale, 6 * scale);
    // Body
    ctx.fillStyle = r.color;
    ctx.fillRect(x - 6 * scale, y - 6 * scale, 12 * scale, 12 * scale);
    // Arms extended (typing)
    const armOffset = Math.sin(r.sittingTimer * 4) < 0 ? 1 : 0;
    ctx.fillRect(x - 10 * scale, y - 4 * scale + armOffset, 4 * scale, 6 * scale);
    ctx.fillRect(x + 6 * scale, y - 4 * scale + armOffset, 4 * scale, 6 * scale);
    // Head
    ctx.fillStyle = lighten(r.color);
    ctx.fillRect(x - 5 * scale, y - 14 * scale, 10 * scale, 10 * scale);
    // Eyes
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 3 * scale, y - 12 * scale, 2 * scale, 2 * scale);
    ctx.fillRect(x + 1 * scale, y - 12 * scale, 2 * scale, 2 * scale);
  } else {
    // Walking / idle
    const bounce = r.phase === 'wandering' || r.phase === 'entering' ? 0 : Math.sin(Date.now() / 300) * 1;
    const yOff = bounce;

    // Legs with walk cycle
    ctx.fillStyle = '#1e293b';
    if (r.path.length > 0) {
      // Walking animation
      ctx.fillRect(x - 6 * scale, y + 4 * scale + (frame === 0 ? -2 : 2) + yOff, 5 * scale, 8 * scale);
      ctx.fillRect(x + 1 * scale, y + 4 * scale + (frame === 0 ? 2 : -2) + yOff, 5 * scale, 8 * scale);
    } else {
      // Standing
      ctx.fillRect(x - 6 * scale, y + 4 * scale + yOff, 5 * scale, 8 * scale);
      ctx.fillRect(x + 1 * scale, y + 4 * scale + yOff, 5 * scale, 8 * scale);
    }

    // Body
    ctx.fillStyle = r.color;
    ctx.fillRect(x - 6 * scale, y - 6 * scale + yOff, 12 * scale, 12 * scale);

    // Arms
    ctx.fillStyle = r.color;
    const armSwing = r.path.length > 0 ? (frame === 0 ? -3 : 3) : 0;
    ctx.fillRect(x - 10 * scale, y - 4 * scale + armSwing + yOff, 4 * scale, 6 * scale);
    ctx.fillRect(x + 6 * scale, y - 4 * scale - armSwing + yOff, 4 * scale, 6 * scale);

    // Head
    ctx.fillStyle = lighten(r.color);
    ctx.fillRect(x - 5 * scale, y - 14 * scale + yOff, 10 * scale, 10 * scale);

    // Eyes
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 3 * scale, y - 12 * scale + yOff, 2 * scale, 2 * scale);
    ctx.fillRect(x + 1 * scale, y - 12 * scale + yOff, 2 * scale, 2 * scale);
  }

  // Blocked badge — red exclamation bubble
  if (r.state === 'blocked') {
    ctx.fillStyle = '#dc2626';
    const bx = x + 8 * scale;
    const by = y - 20 * scale;
    // Speech bubble
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef2f2';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', bx, by + 4);
  }

  // Agent personality icon (above head when sitting/working)
  if (sitting) {
    const iconY = y - 26 * scale;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    const icon = AGENT_ICONS[r.id];
    if (icon) ctx.fillText(icon, x, iconY);

    // Typing sparks — small pixel particles near desk when working
    if (r.state === 'working') {
      const t = r.sittingTimer;
      for (let i = 0; i < 3; i++) {
        const sx = x - 10 + Math.sin(t * 6 + i * 2.1) * 12;
        const sy = y + 2 * scale - Math.abs(Math.sin(t * 8 + i * 1.7)) * 8;
        const sparkAlpha = 0.3 + Math.sin(t * 10 + i * 3) * 0.3;
        ctx.fillStyle = `rgba(14,165,233,${sparkAlpha})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }

    // Coffee mug on desk (steams when active)
    const desk = DESKS[r.id];
    if (desk) {
      const mx = desk.deskX + 68;
      const my = desk.deskY + 8;
      ctx.fillStyle = '#f5f0e0';
      ctx.fillRect(mx, my, 8, 10);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(mx + 8, my + 2, 3, 6); // handle
      if (r.state === 'working') {
        // Steam
        const st = r.sittingTimer;
        for (let i = 0; i < 2; i++) {
          const steamX = mx + 2 + Math.sin(st * 3 + i * 2) * 3;
          const steamY = my - 4 - i * 5;
          ctx.fillStyle = `rgba(148,163,184,${0.3 - i * 0.1})`;
          ctx.fillRect(steamX, steamY, 2, 3);
        }
      }
    }
  }

  // Name tag
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 20, y - 24 * scale - 4, 40, 12);
  ctx.fillStyle = r.color;
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(r.name, x, y - 24 * scale + 7);
}

function drawStatusBar(ctx: CanvasRenderingContext2D, agents: AgentRuntime[]) {
  ctx.fillStyle = C.statusBar;
  ctx.fillRect(0, H - 50, W, 50);
  ctx.strokeStyle = C.statusBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H - 50);
  ctx.lineTo(W, H - 50);
  ctx.stroke();

  const slotW = W / agents.length;
  agents.forEach((r, i) => {
    const bx = i * slotW + slotW / 2;
    const by = H - 25;

    // Color dot
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.arc(bx - 40, by, 5, 0, Math.PI * 2);
    ctx.fill();

    // Name
    ctx.fillStyle = C.textBright;
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(r.name, bx - 30, by - 2);

    // State label
    const stateLabel = {
      working: 'Working',
      blocked: 'Blocked',
      idle: 'Idle',
      offline: 'Offline',
      finished: 'Done',
      reserved: 'Reserved',
    }[r.state] ?? r.state;

    const stateColor = {
      working: '#22c55e',
      blocked: '#f59e0b',
      idle: '#94a3b8',
      offline: '#475569',
      finished: '#60a5fa',
      reserved: '#6b7280',
    }[r.state] ?? C.text;

    ctx.fillStyle = stateColor;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(stateLabel, bx - 30, by + 12);
  });
}

function lighten(hex: string): string {
  // Simple lighten: parse and add 40 to each channel
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 40);
  const g = Math.min(255, ((n >> 8) & 0xff) + 40);
  const b = Math.min(255, (n & 0xff) + 40);
  return `rgb(${r},${g},${b})`;
}

// ─── Demo mode agents (used when no real agents provided) ─────────────────────
const DEMO_AGENTS: OfficeAgent[] = [
  { id: 'main',     name: 'Mildred',  state: 'idle', taskTitle: null, color: '#008080' },
  { id: 'dev',      name: 'Dev',      state: 'idle', taskTitle: null, color: '#808080' },
  { id: 'janet',    name: 'Janet',    state: 'idle', taskTitle: null, color: '#8B4513' },
  { id: 'kimi',     name: 'Kimi',     state: 'idle', taskTitle: null, color: '#2E86C1' },
  { id: 'gpt-mini', name: 'GPT-mini', state: 'idle', taskTitle: null, color: '#27AE60' },
];

// Automated demo scenario: cycles agents through states every few seconds
const DEMO_SCRIPT: Array<{ delay: number; agentId: string; state: OfficeAgent['state'] }> = [
  { delay: 1000,  agentId: 'main',  state: 'working' },
  { delay: 3000,  agentId: 'dev',   state: 'working' },
  { delay: 5000,  agentId: 'janet', state: 'working' },
  { delay: 10000, agentId: 'dev',   state: 'blocked' },
  { delay: 15000, agentId: 'janet', state: 'idle' },
  { delay: 20000, agentId: 'dev',   state: 'working' },
  { delay: 25000, agentId: 'main',  state: 'finished' },
  { delay: 30000, agentId: 'dev',   state: 'finished' },
  { delay: 35000, agentId: 'main',  state: 'working' },
  { delay: 38000, agentId: 'dev',   state: 'working' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function OfficeCanvas2D({ agents: propAgents, onSelectAgent }: OfficeCanvas2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<AgentRuntime[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [demoAgents, setDemoAgents] = useState<OfficeAgent[]>(DEMO_AGENTS);
  const demoTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Use real agents if available, otherwise demo agents
  const agents = propAgents.length > 0 ? propAgents : demoAgents;

  // Start demo auto-cycle when using demo agents
  useEffect(() => {
    if (propAgents.length > 0) return; // skip if real agents

    let step = 0;
    function runStep() {
      if (step >= DEMO_SCRIPT.length) {
        step = 0; // loop
      }
      const { agentId, state, delay } = DEMO_SCRIPT[step];
      const t = setTimeout(() => {
        setDemoAgents(prev => prev.map(a => a.id === agentId ? { ...a, state } : a));
        step++;
        runStep();
      }, delay);
      demoTimersRef.current.push(t);
    }
    runStep();
    return () => demoTimersRef.current.forEach(clearTimeout);
  }, [propAgents.length]);

  // Initialise runtime on first render
  useEffect(() => {
    runtimeRef.current = agents.map(makeRuntime);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state changes from props
  useEffect(() => {
    for (const agent of agents) {
      const r = runtimeRef.current.find(x => x.id === agent.id);
      if (r) {
        syncState(r, agent.state);
        r.name = agent.name;
        r.color = agent.color;
      }
    }
  }, [agents]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function loop(ts: number) {
      const dt = Math.min((ts - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = ts;

      // Update
      for (const r of runtimeRef.current) {
        if (r.visible) updateAgent(r, dt);
      }

      // Render
      ctx!.clearRect(0, 0, W, H - 50);
      drawFloor(ctx!);
      drawConferenceRoom(ctx!);
      drawPhilipOffice(ctx!);
      drawKitchen(ctx!);
      drawLounge(ctx!);
      drawPlants(ctx!);

      // Desks
      for (const [, desk] of Object.entries(DESKS)) {
        drawDesk(ctx!, desk);
      }

      drawDoor(ctx!);

      // Characters (sorted by y for depth)
      const sorted = [...runtimeRef.current].filter(r => r.visible).sort((a, b) => a.pos.y - b.pos.y);
      for (const r of sorted) {
        const desk = DESKS[r.id];
        const sitting = r.phase === 'sitting' && !!desk;
        drawCharacter(ctx!, r, sitting);
      }

      drawStatusBar(ctx!, runtimeRef.current);

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Click handling
  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Scale mouse coords back to canvas pixel space (CSS scales the canvas)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    for (const r of runtimeRef.current) {
      if (!r.visible) continue;
      if (Math.abs(mx - r.pos.x) < 30 && Math.abs(my - r.pos.y) < 34) {
        onSelectAgent?.(r.id);
        break;
      }
    }
  }

  function setAgentState(agentId: string, state: OfficeAgent['state']) {
    setDemoAgents(prev => prev.map(a => a.id === agentId ? { ...a, state } : a));
  }

  const btnBase = 'rounded px-2.5 py-1 text-[10px] font-mono font-bold transition-colors';

  return (
    <div className="space-y-3">
      {/* Demo controls — shown when no real agents are connected */}
      {propAgents.length === 0 && (
        <div className="rounded-xl border border-[#1e293b] bg-[#0a0f1e] p-3">
          <p className="mb-2 text-[10px] font-mono text-[#475569] uppercase tracking-widest">Demo controls — auto-cycling · click to override</p>
          <div className="flex flex-wrap gap-2">
            {demoAgents.map(a => (
              <div key={a.id} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: a.color }} />
                <span className="text-[10px] font-mono text-[#94a3b8] mr-1">{a.name}</span>
                {(['working','blocked','idle','finished'] as OfficeAgent['state'][]).map(s => (
                  <button
                    key={s}
                    onClick={() => setAgentState(a.id, s)}
                    className={`${btnBase} ${a.state === s
                      ? 'bg-[#1e3a5f] text-[#60a5fa] border border-[#2563eb]'
                      : 'bg-[#0f172a] text-[#475569] border border-[#1e293b] hover:text-[#94a3b8]'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={handleClick}
          className="cursor-pointer rounded-2xl border border-[#1e293b]"
          style={{ display: 'block', imageRendering: 'pixelated', width: '100%', height: 'auto' }}
        />
      </div>
    </div>
  );
}
