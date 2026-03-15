export const OFFICE_SCENE_SIZE = {
  width: 1200,
  height: 760,
} as const;

export type OfficeSceneDeskId = 'mildred' | 'dev' | 'research' | 'content';

export const OFFICE_SCENE_CONFIG = {
  door: { x: 0.12, y: 0.72 },
  reportsTray: { x: 0.86, y: 0.78 },
  pathNodes: {
    pathDoorMid: { x: 0.24, y: 0.64 },
    pathCenterTop: { x: 0.5, y: 0.36 },
    pathCenterBottom: { x: 0.5, y: 0.62 },
  },
  desks: {
    mildred: {
      label: 'Mildred',
      taskOwnerLabel: 'Mildred',
      reserved: false,
      desk: { x: 0.3, y: 0.3 },
      avatar: { x: 0.3, y: 0.26 },
      blocked: { x: 0.36, y: 0.22 },
      clickRegion: { x: 0.2, y: 0.18, width: 0.2, height: 0.18 },
      color: '#008080',
      stage: { left: 206, top: 149, scale: 0.92, labelDx: 18, labelDy: -10 },
      sprite: { width: 286, height: 214 },
    },
    dev: {
      label: 'Dev',
      taskOwnerLabel: 'Dev',
      reserved: false,
      desk: { x: 0.7, y: 0.3 },
      avatar: { x: 0.7, y: 0.26 },
      blocked: { x: 0.76, y: 0.22 },
      clickRegion: { x: 0.6, y: 0.18, width: 0.2, height: 0.18 },
      color: '#808080',
      stage: { left: 694, top: 149, scale: 0.92, labelDx: 146, labelDy: -10 },
      sprite: { width: 286, height: 214 },
    },
    research: {
      label: 'Claire',
      taskOwnerLabel: 'Claire',
      reserved: false,
      desk: { x: 0.3, y: 0.6 },
      avatar: { x: 0.3, y: 0.56 },
      blocked: { x: 0.36, y: 0.52 },
      clickRegion: { x: 0.2, y: 0.48, width: 0.2, height: 0.18 },
      color: '#8B4513',
      stage: { left: 206, top: 376, scale: 0.92, labelDx: 18, labelDy: 188 },
      sprite: { width: 286, height: 214 },
    },
    content: {
      label: 'Future',
      taskOwnerLabel: 'Future agent',
      reserved: true,
      desk: { x: 0.7, y: 0.6 },
      avatar: { x: 0.7, y: 0.56 },
      blocked: { x: 0.76, y: 0.52 },
      clickRegion: { x: 0.6, y: 0.48, width: 0.2, height: 0.18 },
      color: '#7c6f4f',
      stage: { left: 694, top: 376, scale: 0.92, labelDx: 146, labelDy: 188 },
      sprite: { width: 286, height: 214 },
    },
  },
} as const;

export const OFFICE_SCENE_DESK_ORDER: OfficeSceneDeskId[] = ['mildred', 'dev', 'research', 'content'];
