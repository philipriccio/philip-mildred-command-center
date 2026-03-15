import { useEffect, useMemo, useRef, useState } from 'react';
import { OFFICE_SCENE_CONFIG, OFFICE_SCENE_SIZE } from '../officeSceneConfig';

export type MovementPhase = 'entering' | 'arriving' | 'sitting' | 'seated' | 'standing' | 'departing' | 'exiting' | 'gone';

export interface AgentMovementState {
  agentId: string;
  phase: MovementPhase;
  progress: number; // 0-100 for current phase
  deskId?: string;
  startTime: number;
}

interface MovementConfig {
  duration: number; // ms for the full movement
  easing: (t: number) => number;
}

// Easing functions for natural, restrained movement - defined before use
const easeOutQuad = (t: number): number => t * (2 - t);
const easeInQuad = (t: number): number => t * t;
const easeInOutQuad = (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

// Restrained, professional timing (~2.5s total for full enter/exit)
const MOVEMENT_CONFIG: Record<MovementPhase, MovementConfig> = {
  entering: { duration: 800, easing: easeOutQuad },    // Door to path midpoint
  arriving: { duration: 900, easing: easeInOutQuad },  // Path midpoint to desk
  sitting: { duration: 400, easing: easeOutQuad },     // Sit down animation
  seated: { duration: 0, easing: (t) => t },           // Stationary
  standing: { duration: 400, easing: easeInQuad },     // Stand up animation
  departing: { duration: 900, easing: easeInOutQuad }, // Desk to path midpoint
  exiting: { duration: 800, easing: easeInQuad },      // Path midpoint to door
  gone: { duration: 0, easing: (t) => t },             // Off-screen
};

// Calculate position along the movement path
function calculatePosition(
  phase: MovementPhase,
  progress: number,
  deskPosition?: { x: number; y: number }
): { x: number; y: number; scale: number; opacity: number } {
  const doorX = OFFICE_SCENE_CONFIG.door.x * OFFICE_SCENE_SIZE.width;
  const doorY = OFFICE_SCENE_CONFIG.door.y * OFFICE_SCENE_SIZE.height;
  const pathMidX = OFFICE_SCENE_CONFIG.pathNodes.pathDoorMid.x * OFFICE_SCENE_SIZE.width;
  const pathMidY = OFFICE_SCENE_CONFIG.pathNodes.pathDoorMid.y * OFFICE_SCENE_SIZE.height;
  const centerTopX = OFFICE_SCENE_CONFIG.pathNodes.pathCenterTop.x * OFFICE_SCENE_SIZE.width;
  const centerTopY = OFFICE_SCENE_CONFIG.pathNodes.pathCenterTop.y * OFFICE_SCENE_SIZE.height;
  const centerBottomX = OFFICE_SCENE_CONFIG.pathNodes.pathCenterBottom.x * OFFICE_SCENE_SIZE.width;
  const centerBottomY = OFFICE_SCENE_CONFIG.pathNodes.pathCenterBottom.y * OFFICE_SCENE_SIZE.height;

  const deskX = deskPosition ? deskPosition.x * OFFICE_SCENE_SIZE.width : centerTopX;
  const deskY = deskPosition ? deskPosition.y * OFFICE_SCENE_SIZE.height : centerTopY;

  switch (phase) {
    case 'entering': {
      // Door -> Path midpoint
      const t = MOVEMENT_CONFIG.entering.easing(progress / 100);
      return {
        x: doorX + (pathMidX - doorX) * t,
        y: doorY + (pathMidY - doorY) * t,
        scale: 0.85 + 0.15 * t,
        opacity: Math.min(1, t * 2),
      };
    }
    case 'arriving': {
      // Path midpoint -> Desk (via center)
      const t = MOVEMENT_CONFIG.arriving.easing(progress / 100);
      // Use appropriate center node based on desk position
      const isTopRow = deskY < OFFICE_SCENE_SIZE.height * 0.5;
      const centerX = isTopRow ? centerTopX : centerBottomX;
      const centerY = isTopRow ? centerTopY : centerBottomY;
      
      // Two-segment path: pathMid -> center -> desk
      if (t < 0.5) {
        const segmentT = t * 2;
        return {
          x: pathMidX + (centerX - pathMidX) * segmentT,
          y: pathMidY + (centerY - pathMidY) * segmentT,
          scale: 0.9 + 0.1 * segmentT,
          opacity: 1,
        };
      } else {
        const segmentT = (t - 0.5) * 2;
        return {
          x: centerX + (deskX - centerX) * segmentT,
          y: centerY + (deskY - centerY) * segmentT,
          scale: 0.95 + 0.05 * segmentT,
          opacity: 1,
        };
      }
    }
    case 'sitting':
    case 'seated': {
      // At desk position
      return {
        x: deskX,
        y: deskY,
        scale: 1,
        opacity: 1,
      };
    }
    case 'standing': {
      // Brief stand-up at desk
      const t = MOVEMENT_CONFIG.standing.easing(progress / 100);
      return {
        x: deskX,
        y: deskY - 5 * t, // Slight upward shift
        scale: 1 + 0.02 * t,
        opacity: 1,
      };
    }
    case 'departing': {
      // Desk -> Path midpoint (via center)
      const t = MOVEMENT_CONFIG.departing.easing(progress / 100);
      const isTopRow = deskY < OFFICE_SCENE_SIZE.height * 0.5;
      const centerX = isTopRow ? centerTopX : centerBottomX;
      const centerY = isTopRow ? centerTopY : centerBottomY;
      
      // Two-segment path: desk -> center -> pathMid
      if (t < 0.5) {
        const segmentT = t * 2;
        return {
          x: deskX + (centerX - deskX) * segmentT,
          y: deskY + (centerY - deskY) * segmentT,
          scale: 1 - 0.05 * segmentT,
          opacity: 1,
        };
      } else {
        const segmentT = (t - 0.5) * 2;
        return {
          x: centerX + (pathMidX - centerX) * segmentT,
          y: centerY + (pathMidY - centerY) * segmentT,
          scale: 0.95 - 0.05 * segmentT,
          opacity: 1,
        };
      }
    }
    case 'exiting': {
      // Path midpoint -> Door
      const t = MOVEMENT_CONFIG.exiting.easing(progress / 100);
      return {
        x: pathMidX + (doorX - pathMidX) * t,
        y: pathMidY + (doorY - pathMidY) * t,
        scale: 0.9 - 0.15 * t,
        opacity: Math.max(0, 1 - t * 1.5),
      };
    }
    case 'gone':
    default: {
      return {
        x: doorX,
        y: doorY,
        scale: 0.7,
        opacity: 0,
      };
    }
  }
}

// Hook to manage agent movement animation
// eslint-disable-next-line react-refresh/only-export-components
export function useAgentMovement(
  initialState?: AgentMovementState
): {
  state: AgentMovementState | null;
  startEntering: (agentId: string, deskId: string) => void;
  startExiting: (agentId: string, deskId: string) => void;
  isMoving: boolean;
} {
  const [state, setState] = useState<AgentMovementState | null>(initialState || null);
  const animationRef = useRef<number | null>(null);

  const animate = (timestamp: number) => {
    setState((current) => {
      if (!current) return null;

      const config = MOVEMENT_CONFIG[current.phase];
      if (config.duration === 0) {
        // Stationary phases - just keep state
        return current;
      }

      const elapsed = timestamp - current.startTime;
      const progress = Math.min(100, (elapsed / config.duration) * 100);

      // Check for phase transition
      if (progress >= 100) {
        const nextPhase = getNextPhase(current.phase);
        if (nextPhase !== current.phase) {
          return {
            ...current,
            phase: nextPhase,
            progress: 0,
            startTime: timestamp,
          };
        }
      }

      return {
        ...current,
        progress,
      };
    });

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (state && state.phase !== 'seated' && state.phase !== 'gone') {
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.agentId]);

  const startEntering = (agentId: string, deskId: string) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setState({
      agentId,
      deskId,
      phase: 'entering',
      progress: 0,
      startTime: performance.now(),
    });
  };

  const startExiting = (agentId: string, deskId: string) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setState({
      agentId,
      deskId,
      phase: 'standing',
      progress: 0,
      startTime: performance.now(),
    });
  };

  const isMoving = Boolean(state && state.phase !== 'seated' && state.phase !== 'gone');

  return { state, startEntering, startExiting, isMoving };
}

function getNextPhase(current: MovementPhase): MovementPhase {
  const transitions: Record<MovementPhase, MovementPhase> = {
    entering: 'arriving',
    arriving: 'sitting',
    sitting: 'seated',
    seated: 'seated',
    standing: 'departing',
    departing: 'exiting',
    exiting: 'gone',
    gone: 'gone',
  };
  return transitions[current];
}

// Component for rendering a moving agent
interface MovingAgentProps {
  agentId: string;
  agentName: string;
  color: string;
  phase: MovementPhase;
  progress: number;
  deskPosition?: { x: number; y: number };
  avatarUrl?: string;
}

export function MovingAgent({
  agentName,
  color,
  phase,
  progress,
  deskPosition,
  avatarUrl,
}: MovingAgentProps) {
  const position = useMemo(
    () => calculatePosition(phase, progress, deskPosition),
    [phase, progress, deskPosition]
  );

  const isSitting = phase === 'sitting' || phase === 'seated';
  const isStanding = phase === 'standing';
  const isTransitioning = phase === 'entering' || phase === 'arriving' || phase === 'departing' || phase === 'exiting';

  return (
    <div
      className="pointer-events-none absolute z-[5] transition-none"
      style={{
        left: position.x,
        top: position.y,
        transform: `translate(-50%, -50%) scale(${position.scale})`,
        opacity: position.opacity,
      }}
    >
      {/* Agent shadow: x=4px, y=6px, #1a1a2e at 15% opacity, 8-12px blur */}
      <div
        className="absolute left-1/2 top-[70%] rounded-full transition-all"
        style={{
          width: '40px',
          height: '12px',
          transform: `translateX(-50%) scale(${isTransitioning ? 0.8 : 1})`,
          opacity: isTransitioning ? 0.6 : 1,
          boxShadow: '4px 6px 10px rgba(26, 26, 46, 0.15)',
        }}
      />

      {/* Agent body/avatar container with breathing when seated */}
      <div
        className={`relative transition-transform duration-300 ${
          isSitting ? 'avatar-breathing translate-y-2' : isStanding ? '-translate-y-1' : ''
        }`}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={agentName}
            className="h-[48px] w-[48px] rounded-full object-cover [image-rendering:pixelated]"
            style={{
              boxShadow: `0 0 0 3px ${color}, 4px 6px 10px rgba(26, 26, 46, 0.15)`,
              filter: isTransitioning ? 'brightness(0.95)' : 'none',
            }}
          />
        ) : (
          <div
            className="flex h-[48px] w-[48px] items-center justify-center rounded-full text-sm font-bold text-white"
            style={{
              backgroundColor: color,
              boxShadow: '4px 6px 10px rgba(26, 26, 46, 0.15)',
            }}
          >
            {agentName.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Status indicator dot */}
        <div
          className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[#141915]"
          style={{
            backgroundColor: isTransitioning ? '#60a5fa' : isSitting ? '#10b981' : '#f59e0b',
          }}
        />
      </div>

      {/* Agent label */}
      <div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
      >
        {agentName}
      </div>
    </div>
  );
}

// CSS keyframe animations for additional polish
export const agentMovementStyles = `
@keyframes agent-enter {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes agent-exit {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
}

@keyframes agent-sit {
  0% {
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    transform: translate(-50%, -55%) scale(1.02);
  }
  100% {
    transform: translate(-50%, -48%) scale(1);
  }
}

@keyframes agent-stand {
  0% {
    transform: translate(-50%, -48%) scale(1);
  }
  50% {
    transform: translate(-50%, -55%) scale(1.02);
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
  }
}
`;
