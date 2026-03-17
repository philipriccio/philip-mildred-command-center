import { useEffect, forwardRef, useImperativeHandle } from 'react';
import blockedBadgeAsset from '../../assets/generated/blocked-badge-v2.png';
import deskEmptyAsset from '../../assets/generated/desk-empty-v1.png';
import deskIdleAsset from '../../assets/generated/desk-idle-v1.png';
import deskWorkingAsset from '../../assets/generated/desk-working-v1.png';
import reportsTrayAsset from '../../assets/generated/reports-tray-v1.png';

// Pixel art sprites (served from public/sprites/)
const devAvatarAsset = '/sprites/sprite-dev.png';
const mildredAvatarAsset = '/sprites/sprite-mildred.png';
const officeMasterSceneAsset = '/sprites/office-background.png';
const researchAvatarAsset = '/sprites/sprite-claire.png';
const contentAvatarAsset = '/sprites/sprite-future.png';
import { OFFICE_SCENE_CONFIG, OFFICE_SCENE_SIZE, type OfficeSceneDeskId } from '../officeSceneConfig';
import { MovingAgent, useAgentMovement } from './AgentMovement';

interface OfficeDeskAgent {
  id: string;
  name: string;
  color: string;
  state: 'working' | 'blocked' | 'inactive' | 'finished' | 'reserved';
  taskTitle: string | null;
  progress: number;
  summary: string | null;
  blocker: string | null;
  isClickable: boolean;
}

interface OfficeDesk {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  agent: OfficeDeskAgent;
}

// Avatar sprite integration - all agents have their avatar images
const AVATAR_ASSETS: Record<string, string> = {
  mildred: mildredAvatarAsset,
  dev: devAvatarAsset,
  research: researchAvatarAsset,
  content: contentAvatarAsset,
};

const AVATAR_OFFSETS: Record<string, { left: number; top: number; width: number; height: number }> = {
  mildred: { left: 20, top: -90, width: 160, height: 160 },
  dev: { left: 20, top: -90, width: 160, height: 160 },
  research: { left: 20, top: -90, width: 160, height: 160 },
  content: { left: 20, top: -90, width: 160, height: 160 },
};

export interface OfficeCanvasHandle {
  startAgentEnter: (agentId: string, deskId: string) => void;
  startAgentExit: (agentId: string, deskId: string) => void;
  isAgentMoving: () => boolean;
}

export const OfficeCanvas = forwardRef<OfficeCanvasHandle, { desks: OfficeDesk[]; onSelectAgent: (agentId: string) => void }>(
  function OfficeCanvas({ desks, onSelectAgent }, ref) {
    // Initialize movement system - demo mode for now
    const { state: movementState, startEntering, startExiting, isMoving } = useAgentMovement();

    // Expose movement controls via ref
    useImperativeHandle(ref, () => ({
      startAgentEnter: startEntering,
      startAgentExit: startExiting,
      isAgentMoving: () => isMoving,
    }));

    // Demo: trigger movement on mount for testing (remove in production)
    useEffect(() => {
      // Small delay to let scene render first
      const timer = setTimeout(() => {
        // You can trigger movements here for testing
        // startEntering('dev', 'dev');
      }, 1000);
      return () => clearTimeout(timer);
    }, []);

    // Get desk config for movement positioning
    const getDeskPosition = (deskId: string) => {
      const desk = desks.find(d => d.id === deskId);
      if (!desk) return undefined;
      const config = OFFICE_SCENE_CONFIG.desks[deskId as OfficeSceneDeskId];
      return config ? { x: config.desk.x, y: config.desk.y } : undefined;
    };

    return (
    <div className="office-scene-container overflow-x-auto">
      <div className="mx-auto" style={{ width: OFFICE_SCENE_SIZE.width }}>
        <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-[#4c564a] bg-[#20251f] px-5 py-4 text-[#eef1e2] shadow-[0_18px_45px_rgba(15,23,42,0.28)]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#96a08b]">Mission Control office</p>
            <p className="mt-1 text-base font-semibold">Master scene implementation</p>
          </div>
          <div className="rounded-xl border border-[#5d6958] bg-[#171b16] px-4 py-2 text-sm text-[#d8dec7]">
            Shared world with scene config as the single source of truth.
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[34px] border border-[#435043] bg-[#141915] shadow-[0_30px_90px_rgba(15,23,42,0.42)]" style={{ width: OFFICE_SCENE_SIZE.width, height: OFFICE_SCENE_SIZE.height }}>
          <img src={officeMasterSceneAsset} alt="Mission Control office" className="absolute inset-0 h-full w-full object-cover" />

          <div
            className="pointer-events-none absolute inset-y-[16%] z-[1] rounded-[48px] border border-white/5 bg-white/[0.02]"
            style={{ left: '44%', right: '44%' }}
          />

          {desks.map((desk) => (
            <DeskStage key={desk.id} desk={desk} onSelectAgent={onSelectAgent} />
          ))}

          {/* Reports Tray with polish layer animations */}
          <ReportsTrayWithPolish pendingCount={desks.filter(d => d.agent.state === 'finished').length} />

          {/* Moving Agents Layer */}
          {movementState && movementState.phase !== 'gone' && (
            <MovingAgent
              agentId={movementState.agentId}
              agentName={desks.find(d => d.id === movementState.agentId)?.agent.name || movementState.agentId}
              color={desks.find(d => d.id === movementState.agentId)?.color || '#64748b'}
              phase={movementState.phase}
              progress={movementState.progress}
              deskPosition={getDeskPosition(movementState.deskId || movementState.agentId)}
              avatarUrl={AVATAR_ASSETS[movementState.agentId]}
            />
          )}
        </div>
      </div>
    </div>
  );
});

function DeskStage({ desk, onSelectAgent }: { desk: OfficeDesk; onSelectAgent: (agentId: string) => void }) {
  const deskId = desk.id as OfficeSceneDeskId;
  const config = OFFICE_SCENE_CONFIG.desks[deskId];
  const clickable = desk.agent.isClickable;
  const deskAsset = desk.agent.state === 'inactive' || desk.agent.state === 'reserved'
    ? deskEmptyAsset
    : desk.agent.state === 'finished'
      ? deskIdleAsset
      : deskWorkingAsset;
  const avatarAsset = AVATAR_ASSETS[desk.id];
  const avatarOffset = AVATAR_OFFSETS[desk.id];

  // Glow state based on agent state
  const glowClass = desk.agent.state === 'working'
    ? 'desk-glow-working'
    : desk.agent.state === 'blocked'
      ? 'desk-glow-blocked'
      : '';

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickable) {
      onSelectAgent(desk.agent.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (clickable) {
        onSelectAgent(desk.agent.id);
      }
    }
  };

  return (
    <div className="absolute" style={{ left: config.stage.left, top: config.stage.top, zIndex: desk.id === 'research' || desk.id === 'content' ? 4 : 3 }}>
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={!clickable}
        className={`group relative block text-left outline-none transition-transform duration-150 ${clickable ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'} ${!clickable ? 'opacity-90' : ''}`}
        style={{ width: config.sprite.width * config.stage.scale, height: config.sprite.height * config.stage.scale }}
        aria-label={`${desk.label} desk ${desk.agent.name} ${desk.agent.taskTitle || stateLabel(desk.agent.state)}`}
        tabIndex={clickable ? 0 : -1}
      >
        {/* No desk sprite — desks are baked into the master background scene */}

        {/* Avatar with breathing animation and hover state */}
        {avatarAsset && desk.agent.state !== 'inactive' && desk.agent.state !== 'reserved' && (
          <img
            src={avatarAsset}
            alt=""
            className={`pointer-events-none absolute object-contain [image-rendering:pixelated] avatar-breathing ${clickable ? 'group-hover:brightness-110' : ''}`}
            style={{
              left: avatarOffset.left * config.stage.scale,
              top: avatarOffset.top * config.stage.scale,
              width: avatarOffset.width * config.stage.scale,
              height: avatarOffset.height * config.stage.scale,
            }}
          />
        )}

        {/* Blocked badge with arrival animation and pulse */}
        {desk.agent.state === 'blocked' && (
          <img
            src={blockedBadgeAsset}
            alt=""
            className="badge-arrival badge-pulse pointer-events-none absolute object-contain [image-rendering:pixelated]"
            style={{
              left: (config.blocked.x - config.desk.x) * OFFICE_SCENE_SIZE.width,
              top: (config.blocked.y - config.desk.y) * OFFICE_SCENE_SIZE.height,
              width: 48 * config.stage.scale,
              height: 48 * config.stage.scale,
              filter: 'drop-shadow(4px 6px 8px rgba(26, 26, 46, 0.15))',
            }}
          />
        )}

        {/* Progress bar with smooth transition */}
        {desk.agent.state !== 'inactive' && desk.agent.state !== 'finished' && desk.agent.state !== 'reserved' && (
          <div className="absolute left-1/2 top-[155px] -translate-x-1/2" style={{ width: 118 * config.stage.scale }}>
            <div className="h-[7px] overflow-hidden rounded-full bg-black/28">
              <div
                className={`progress-bar ${desk.agent.state === 'blocked' ? 'bg-amber-300' : 'bg-emerald-300'} h-full rounded-full`}
                style={{ width: `${desk.agent.progress}%` }}
              />
            </div>
          </div>
        )}

        <DeskLabel desk={desk} x={config.stage.labelDx} y={config.stage.labelDy} />
        <ClickRegion region={config.clickRegion} deskAnchor={config.desk} />
      </button>
    </div>
  );
}

function DeskLabel({ desk, x, y }: { desk: OfficeDesk; x: number; y: number }) {
  const tone = {
    working: 'bg-[#1c241b]/76 text-[#eef4e5]',
    blocked: 'bg-[#2b2418]/78 text-[#fff0d4]',
    inactive: 'bg-[#1b211a]/74 text-[#d6deca]',
    finished: 'bg-[#182326]/78 text-[#e4f5f6]',
    reserved: 'bg-[#22231e]/78 text-[#efe8cb]',
  }[desk.agent.state];

  return (
    <div className={`desk-label pointer-events-none absolute rounded-lg px-2.5 py-1.5 shadow-sm shadow-black/10 ${tone}`} style={{ left: x, top: y, width: 132 }}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: desk.color }} />
        <p className="truncate text-xs font-semibold">{desk.label}</p>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] leading-4 opacity-80">
        {desk.agent.taskTitle || stateLabel(desk.agent.state)}
      </p>
    </div>
  );
}

function ClickRegion({ region, deskAnchor }: { region: { x: number; y: number; width: number; height: number }; deskAnchor: { x: number; y: number } }) {
  return (
    <span
      aria-hidden="true"
      className="click-region absolute rounded-[24px] border border-white/0 transition-all duration-200 group-hover:border-white/15 group-hover:bg-white/[0.05] group-active:bg-white/[0.08]"
      style={{
        left: (region.x - deskAnchor.x) * OFFICE_SCENE_SIZE.width,
        top: (region.y - deskAnchor.y) * OFFICE_SCENE_SIZE.height,
        width: region.width * OFFICE_SCENE_SIZE.width,
        height: region.height * OFFICE_SCENE_SIZE.height,
      }}
    />
  );
}

function stateLabel(state: OfficeDeskAgent['state']) {
  if (state === 'working') return 'Active task in progress.';
  if (state === 'blocked') return 'Blocked and waiting.';
  if (state === 'finished') return 'Finished and stepped away.';
  if (state === 'reserved') return 'Reserved for future agent.';
  return 'Desk empty.';
}

// Reports Tray with polish layer animations
function ReportsTrayWithPolish({ pendingCount }: { pendingCount: number }) {
  // Simple approach: just use the pending count to determine visual state
  // The animation is handled via CSS classes that trigger on mount/change
  const trayClass = pendingCount > 0
    ? 'tray-anticipation tray-populated'
    : '';

  const arrivalClass = pendingCount > 0 ? 'tray-arrival' : '';

  return (
    <div
      className={`pointer-events-none absolute z-[3] ${trayClass} ${arrivalClass}`}
      style={{
        left: OFFICE_SCENE_CONFIG.reportsTray.x * OFFICE_SCENE_SIZE.width - 46,
        top: OFFICE_SCENE_CONFIG.reportsTray.y * OFFICE_SCENE_SIZE.height - 42,
        width: 92,
        height: 92,
      }}
    >
      {/* Shadow: x=4px, y=6px, #1a1a2e at 15% opacity, 8-12px blur */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: '4px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70px',
          height: '18px',
          boxShadow: '4px 6px 10px rgba(26, 26, 46, 0.15)',
        }}
      />
      <img
        src={reportsTrayAsset}
        alt="Reports tray"
        className="absolute inset-0 h-full w-full object-contain [image-rendering:pixelated]"
      />
      {/* Pending indicator badge */}
      {pendingCount > 0 && (
        <div className="badge-arrival absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white shadow-lg">
          {pendingCount}
        </div>
      )}
    </div>
  );
}
