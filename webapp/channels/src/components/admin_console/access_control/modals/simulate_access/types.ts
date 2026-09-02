// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PolicySimulationActionDecision, PolicySimulationSession} from '@mattermost/types/access_control';
import type {UserProfile} from '@mattermost/types/users';

/**
 * One staged user in the picker. The author selects users via
 * AddUsersInline; each selection becomes a `RowState` that the parent
 * SimulateAccessModal owns and the per-row PickerRow component
 * displays. `sessionOverrides` mirrors the per-row session-attribute
 * editor (pencil icon) and is forwarded to the simulator on the next
 * Re-run.
 */
export type RowState = {
    user: UserProfile;
    sessionOverrides: Record<string, string>;
};

/**
 * Per-user simulator response payload. Bundles the headline `decisions`
 * map (per-action verdicts) with the optional per-session breakdown
 * and the user attribute snapshot used for evaluation. Surfaced on
 * each PickerRow and forwarded to DecisionDetailsModal as part of the
 * evaluation trace.
 */
export type UserDecisionsBundle = {
    decisions?: Record<string, PolicySimulationActionDecision>;
    sessions?: PolicySimulationSession[];

    /** User profile attribute snapshot returned by the simulator
     *  (department, region, etc.). Surfaced inside DecisionDetailsModal
     *  as part of the evaluation trace. */
    attributes?: Record<string, string>;
};
