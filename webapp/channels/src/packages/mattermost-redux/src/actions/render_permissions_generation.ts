// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Ordering identity for fetches and invalidations, so the reducer can drop superseded completions.
// A counter rather than Date.now(), which collides within a millisecond. Kept apart from
// render_permissions.ts so dm_gm_access.ts can stamp denials without importing helpers.ts.
let generationCounter = 0;

export function nextRenderDecisionGeneration(): number {
    return ++generationCounter;
}

export function currentRenderDecisionGeneration(): number {
    return generationCounter;
}
