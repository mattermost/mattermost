// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const EXPLORER_MODES = ['replay', 'explore', 'guard-check', 'probe-absence'] as const;
export type ExplorerMode = (typeof EXPLORER_MODES)[number];

export function explorerMode(): ExplorerMode {
    const mode = (process.env.EXPLORER_MODE || 'replay') as ExplorerMode;
    if (!EXPLORER_MODES.includes(mode)) {
        throw new Error(`EXPLORER_MODE must be one of ${EXPLORER_MODES.join(', ')}`);
    }
    return mode;
}
