// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum SidebarSize {
    SMALL='small',
    MEDIUM= 'medium',
    LARGE= 'large',
    XLARGE= 'xLarge',
}

export enum ResizeDirection {
    LEFT = 'left',
    RIGHT = 'right',
}

export enum CssVarKeyForResizable {
    LHS = 'overrideLhsWidth',
    RHS = 'overrideRhsWidth',
}

export const SIDEBAR_SNAP_SIZE = 16;
export const SIDEBAR_SNAP_SPEED_LIMIT = 5;

export const DEFAULT_LHS_WIDTH = 240;

export const RHS_MIN_MAX_WIDTH: { [size in SidebarSize]: { min: number; max: number; default: number}} = {
    [SidebarSize.SMALL]: {
        min: 400,
        max: 400,
        default: 400,
    },
    [SidebarSize.MEDIUM]: {
        min: 304,
        max: 400,
        default: 400,
    },
    [SidebarSize.LARGE]: {
        min: 304,
        max: 464,
        default: 400,
    },
    [SidebarSize.XLARGE]: {
        min: 304,
        max: 776,
        default: 500,
    },
};
