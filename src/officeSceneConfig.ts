export const OFFICE_SCENE_SIZE = {
  width: 1024,
  height: 1536,
} as const;

export type OfficeSceneDeskId = 'mildred' | 'dev' | 'research' | 'content';

// Desk positions calculated for portrait 1024x1536 background
// Top desk (Dev - near window): ~x=680, y=380
// Middle-left desk (Mildred): ~x=180, y=680
// Bottom-right desk (Future - empty): ~x=720, y=980
// Bottom-left desk (Claire - with divider): ~x=280, y=1280
export const OFFICE_SCENE_CONFIG = {
  door: { x: 0.15, y: 0.12 },
  reportsTray: { x: 0.85, y: 0.25 },
  pathNodes: {
    pathDoorMid: { x: 0.25, y: 0.2 },
    pathCenterTop: { x: 0.5, y: 0.35 },
    pathCenterBottom: { x: 0.5, y: 0.65 },
  },
  desks: {
    mildred: {
      label: 'Mildred',
      taskOwnerLabel: 'Mildred',
      reserved: false,
      desk: { x: 0.25, y: 0.45 },
      avatar: { x: 0.25, y: 0.42 },
      blocked: { x: 0.3, y: 0.38 },
      clickRegion: { x: 0.15, y: 0.38, width: 0.25, height: 0.15 },
      color: '#008080',
      stage: { left: 120, top: 580, scale: 0.85, labelDx: 10, labelDy: -10 },
      sprite: { width: 286, height: 214 },
    },
    dev: {
      label: 'Dev',
      taskOwnerLabel: 'Dev',
      reserved: false,
      desk: { x: 0.72, y: 0.28 },
      avatar: { x: 0.72, y: 0.25 },
      blocked: { x: 0.78, y: 0.22 },
      clickRegion: { x: 0.6, y: 0.22, width: 0.25, height: 0.15 },
      color: '#808080',
      stage: { left: 620, top: 320, scale: 0.85, labelDx: 140, labelDy: -10 },
      sprite: { width: 286, height: 214 },
    },
    research: {
      label: 'Claire',
      taskOwnerLabel: 'Claire',
      reserved: false,
      desk: { x: 0.35, y: 0.82 },
      avatar: { x: 0.35, y: 0.79 },
      blocked: { x: 0.4, y: 0.75 },
      clickRegion: { x: 0.2, y: 0.75, width: 0.3, height: 0.15 },
      color: '#8B4513',
      stage: { left: 200, top: 1180, scale: 0.85, labelDx: 10, labelDy: 180 },
      sprite: { width: 286, height: 214 },
    },
    content: {
      label: 'Future',
      taskOwnerLabel: 'Future agent',
      reserved: true,
      desk: { x: 0.75, y: 0.62 },
      avatar: { x: 0.75, y: 0.59 },
      blocked: { x: 0.8, y: 0.55 },
      clickRegion: { x: 0.62, y: 0.55, width: 0.25, height: 0.15 },
      color: '#7c6f4f',
      stage: { left: 640, top: 880, scale: 0.85, labelDx: 140, labelDy: 180 },
      sprite: { width: 286, height: 214 },
    },
  },
} as const;

export const OFFICE_SCENE_DESK_ORDER: OfficeSceneDeskId[] = ['mildred', 'dev', 'research', 'content'];
