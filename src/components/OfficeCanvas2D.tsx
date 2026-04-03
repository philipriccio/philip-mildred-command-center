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
  inboxCount?: number;
  onInboxClick?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 900;
const H = 580;
const WALK_SPEED = 120; // px/sec

// Room layout zones
const ROOM_TOP = 8;     // top of rooms area
const ROOM_H = 140;     // height of rooms
const WORK_TOP = ROOM_TOP + ROOM_H + 50; // extra gap between rooms and desks
const STATUS_H = 50;

// Colors — clean, minimal
const C = {
  floor: '#fafafa',
  floorLine: '#e5e7eb',
  desk: '#1e293b',
  deskBorder: '#334155',
  monitor: '#0ea5e9',
  monitorScreen: '#172554',
  chair: '#4b5563',
  door: '#d97706',
  text: '#64748b',
  textBright: '#1e293b',
  statusBar: '#0a0f1e',
  statusBorder: '#1e293b',
  ctRed: '#b91c1c',
  ctGold: '#fbbf24',
  curtainRed: '#7f1d1d',
  roomWall: '#1e293b',
  roomFloor: '#f1f5f9',
  roomBorder: '#334155',
  greenRoomWall: '#14532d',
  greenRoomFloor: '#ecfdf5',
  officeWall: '#450a0a',
  officeFloor: '#fef2f2',
  furniture: '#78716c',
  inboxTray: '#d97706',
};

// ─── Philip's Office (top-left) ──────────────────────────────────────────────
const OFFICE = { x: 16, y: ROOM_TOP, w: 260, h: ROOM_H };

// ─── Green Room / Lounge (top-right) ─────────────────────────────────────────
const GREEN_ROOM = { x: W - 16 - 320, y: ROOM_TOP, w: 320, h: ROOM_H };

// ─── Layout — desks in a single row below rooms ─────────────────────────────
const DOOR = { x: W / 2 - 20, y: H - STATUS_H - 18, w: 40, h: 12 };

// 5 desks evenly spaced in one row
const DESK_SPACING = W / 6;
const DESK_Y = WORK_TOP + 30; // desk surface Y
const CHAIR_Y = DESK_Y + 60; // where the agent sits

const DESK_IDS = ['main', 'dev', 'janet', 'kimi', 'gpt-mini'] as const;
const DESK_LABELS: Record<string, string> = {
  main: 'Mildred', dev: 'Dev', janet: 'Janet', kimi: 'Kimi', 'gpt-mini': 'GPT-mini',
};

const DESKS: Record<string, { x: number; y: number; deskX: number; deskY: number; label: string }> = {};
DESK_IDS.forEach((id, i) => {
  const cx = DESK_SPACING * (i + 1);
  DESKS[id] = {
    x: cx,
    y: CHAIR_Y,
    deskX: cx - 40,
    deskY: DESK_Y,
    label: DESK_LABELS[id],
  };
});

// Waypoints
const WP = {
  door:    { x: W / 2, y: H - STATUS_H - 30 },
  hub:     { x: W / 2, y: CHAIR_Y + 40 },
  kitchen: { x: GREEN_ROOM.x + 60, y: GREEN_ROOM.y + GREEN_ROOM.h / 2 },
  lounge:  { x: GREEN_ROOM.x + GREEN_ROOM.w / 2, y: GREEN_ROOM.y + GREEN_ROOM.h / 2 },
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

function buildPath(_from: Vec2, desk: { x: number; y: number }): Vec2[] {
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
function drawFloor(ctx: CanvasRenderingContext2D, inboxCount: number) {
  // Clean white floor
  ctx.fillStyle = C.floor;
  ctx.fillRect(0, 0, W, H - STATUS_H);

  // Subtle grid lines
  ctx.strokeStyle = C.floorLine;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, WORK_TOP);
    ctx.lineTo(x, H - STATUS_H);
    ctx.stroke();
  }
  for (let y = WORK_TOP; y < H - STATUS_H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Top accent line (curtain red valance)
  ctx.fillStyle = C.curtainRed;
  ctx.fillRect(0, 0, W, 6);
  ctx.fillStyle = 'rgba(251,191,36,0.3)';
  ctx.fillRect(0, 0, W, 3);

  // ─── Philip's Office (top-left) ────────────────────────────
  const o = OFFICE;
  const oDoorW = 36;
  const oDoorX = o.x + o.w / 2 - oDoorW / 2; // centered on bottom wall
  // Floor
  ctx.fillStyle = C.officeFloor;
  ctx.fillRect(o.x, o.y, o.w, o.h);
  // Walls with door opening on bottom
  ctx.strokeStyle = C.officeWall;
  ctx.lineWidth = 3;
  // Top wall
  ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w, o.y); ctx.stroke();
  // Left wall
  ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x, o.y + o.h); ctx.stroke();
  // Right wall
  ctx.beginPath(); ctx.moveTo(o.x + o.w, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.stroke();
  // Bottom wall — two segments with gap for door
  ctx.beginPath(); ctx.moveTo(o.x, o.y + o.h); ctx.lineTo(oDoorX, o.y + o.h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(oDoorX + oDoorW, o.y + o.h); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.stroke();
  // Door frame + label
  ctx.fillStyle = C.door;
  ctx.fillRect(oDoorX, o.y + o.h - 3, oDoorW, 6);
  ctx.fillStyle = C.ctGold;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⭐', oDoorX + oDoorW / 2, o.y + o.h + 14);
  // Red accent wall (left)
  ctx.fillStyle = C.ctRed;
  ctx.fillRect(o.x, o.y, 4, o.h);
  // Label
  ctx.fillStyle = C.officeWall;
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText("Philip's Office", o.x + o.w / 2, o.y + 18);
  // Desk in Philip's office
  ctx.fillStyle = '#5c3a1e';
  ctx.fillRect(o.x + 20, o.y + 40, 100, 40);
  ctx.strokeStyle = '#44280e';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(o.x + 20, o.y + 40, 100, 40);
  // Monitor on Philip's desk
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(o.x + 50, o.y + 28, 30, 20);
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(o.x + 52, o.y + 30, 26, 16);
  // Chair
  ctx.fillStyle = '#991b1b';
  ctx.fillRect(o.x + 55, o.y + 88, 30, 20);
  // Inbox tray (physical tray on desk)
  const trayX = o.x + 140;
  const trayY = o.y + 44;
  ctx.fillStyle = C.inboxTray;
  ctx.fillRect(trayX, trayY, 50, 8);
  ctx.fillRect(trayX, trayY + 12, 50, 8);
  ctx.fillRect(trayX, trayY + 24, 50, 8);
  // Inbox label
  ctx.fillStyle = C.officeWall;
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillText('📥 INBOX', trayX + 25, trayY - 4);
  // Inbox count badge
  if (inboxCount > 0) {
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(trayX + 50, trayY - 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(String(inboxCount), trayX + 50, trayY - 1);
  }
  // Papers in tray (visual hint)
  if (inboxCount > 0) {
    ctx.fillStyle = '#fefce8';
    for (let i = 0; i < Math.min(inboxCount, 3); i++) {
      ctx.fillRect(trayX + 4 + i * 2, trayY + 2 + i * 12, 42, 6);
    }
  }
  // Bookshelf on back wall
  ctx.fillStyle = '#5c3a1e';
  ctx.fillRect(o.x + 210, o.y + 30, 36, 80);
  ctx.fillStyle = '#44280e';
  ctx.fillRect(o.x + 210, o.y + 55, 36, 2);
  ctx.fillRect(o.x + 210, o.y + 80, 36, 2);
  // Books
  const bookColors = ['#dc2626','#2563eb','#16a34a','#d97706','#7c3aed'];
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = bookColors[i];
    ctx.fillRect(o.x + 213 + i * 6, o.y + 33, 5, 20);
  }

  // ─── Green Room / Lounge (top-right) ───────────────────────
  const g = GREEN_ROOM;
  const gDoorW = 40;
  const gDoorX = g.x + g.w / 2 - gDoorW / 2; // centered on bottom wall
  // Floor
  ctx.fillStyle = C.greenRoomFloor;
  ctx.fillRect(g.x, g.y, g.w, g.h);
  // Walls with door opening on bottom
  ctx.strokeStyle = C.greenRoomWall;
  ctx.lineWidth = 3;
  // Top wall
  ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + g.w, g.y); ctx.stroke();
  // Left wall
  ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x, g.y + g.h); ctx.stroke();
  // Right wall
  ctx.beginPath(); ctx.moveTo(g.x + g.w, g.y); ctx.lineTo(g.x + g.w, g.y + g.h); ctx.stroke();
  // Bottom wall — two segments with gap for door
  ctx.beginPath(); ctx.moveTo(g.x, g.y + g.h); ctx.lineTo(gDoorX, g.y + g.h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(gDoorX + gDoorW, g.y + g.h); ctx.lineTo(g.x + g.w, g.y + g.h); ctx.stroke();
  // Door frame
  ctx.fillStyle = C.greenRoomWall;
  ctx.fillRect(gDoorX, g.y + g.h - 3, gDoorW, 6);
  ctx.fillStyle = '#22c55e';
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GREEN ROOM', gDoorX + gDoorW / 2, g.y + g.h + 14);
  // Label with vanity lights
  ctx.fillStyle = C.greenRoomWall;
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('💡 Green Room 💡', g.x + g.w / 2, g.y + 18);

  // Large table (center of green room)
  const tableX = g.x + g.w / 2 - 60;
  const tableY = g.y + 40;
  ctx.fillStyle = '#78716c';
  ctx.fillRect(tableX, tableY, 120, 50);
  ctx.strokeStyle = '#57534e';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tableX, tableY, 120, 50);
  // Table legs
  ctx.fillStyle = '#57534e';
  ctx.fillRect(tableX + 5, tableY + 50, 4, 8);
  ctx.fillRect(tableX + 111, tableY + 50, 4, 8);

  // Chairs around table
  ctx.fillStyle = '#4b5563';
  // Top chairs
  ctx.fillRect(tableX + 20, tableY - 14, 20, 12);
  ctx.fillRect(tableX + 50, tableY - 14, 20, 12);
  ctx.fillRect(tableX + 80, tableY - 14, 20, 12);
  // Bottom chairs
  ctx.fillRect(tableX + 20, tableY + 52, 20, 12);
  ctx.fillRect(tableX + 50, tableY + 52, 20, 12);
  ctx.fillRect(tableX + 80, tableY + 52, 20, 12);

  // Couch (left side of green room)
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(g.x + 14, g.y + 40, 24, 60);
  ctx.fillStyle = '#991b1b';
  ctx.fillRect(g.x + 16, g.y + 44, 20, 52);
  // Couch label
  ctx.fillStyle = '#57534e';
  ctx.font = '8px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('🛋️', g.x + 26, g.y + 112);

  // Comfortable chairs (right side)
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(g.x + g.w - 50, g.y + 45, 24, 24);
  ctx.fillRect(g.x + g.w - 50, g.y + 78, 24, 24);
  // Coffee table
  ctx.fillStyle = '#a8a29e';
  ctx.fillRect(g.x + g.w - 80, g.y + 58, 22, 30);

  // Coffee machine
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(g.x + g.w - 40, g.y + 28, 20, 16);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(g.x + g.w - 38, g.y + 30, 3, 3);
  ctx.fillStyle = '#57534e';
  ctx.font = '8px "JetBrains Mono", monospace';
  ctx.fillText('☕', g.x + g.w - 30, g.y + 56);

  // CT watermark — subtle in work area
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = C.ctRed;
  ctx.font = 'bold 60px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CT', W / 2, CHAIR_Y + 60);
  ctx.restore();
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

  // Name plate — dark text on white floor for visibility
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(d.label, d.deskX + 40, d.deskY + 68);
}

function drawDoor(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.door;
  ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  ctx.fillStyle = C.textBright;
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('🎭 STAGE DOOR', DOOR.x + DOOR.w / 2, DOOR.y - 4);
}

// Room/lounge/kitchen/plant functions removed — clean minimal layout

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

  // Name tag — dark pill on white floor
  ctx.fillStyle = 'rgba(30,41,59,0.85)';
  ctx.fillRect(x - 24, y - 24 * scale - 4, 48, 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(r.name, x, y - 24 * scale + 7);
}

function drawStatusBar(ctx: CanvasRenderingContext2D, agents: AgentRuntime[]) {
  ctx.fillStyle = C.statusBar;
  ctx.fillRect(0, H - STATUS_H, W, STATUS_H);
  ctx.strokeStyle = C.statusBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H - STATUS_H);
  ctx.lineTo(W, H - STATUS_H);
  ctx.stroke();

  const slotW = W / agents.length;
  agents.forEach((r, i) => {
    const bx = i * slotW + slotW / 2;
    const by = H - STATUS_H / 2;

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
export function OfficeCanvas2D({ agents: propAgents, onSelectAgent, inboxCount = 0, onInboxClick }: OfficeCanvas2DProps) {
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
      ctx!.clearRect(0, 0, W, H - STATUS_H);
      drawFloor(ctx!, inboxCount);

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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Check inbox tray click (in Philip's office)
    const trayX = OFFICE.x + 140;
    const trayY = OFFICE.y + 44;
    if (mx >= trayX && mx <= trayX + 50 && my >= trayY - 10 && my <= trayY + 40) {
      onInboxClick?.();
      return;
    }

    // Check agent clicks
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
