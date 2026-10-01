// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type HealthFindingSeverity = 'critical' | 'warning' | 'info';

export type HealthFindingState = 'firing' | 'resolved' | 'unknown';

export type HealthFinding = {
    fingerprint: string;
    code: string;
    subject: string;

    // Hostname of a node-scoped finding, or '' for a cluster-global one.
    scope: string;
    severity: HealthFindingSeverity;
    state: HealthFindingState;
    area: string;
    surface: 'product' | 'internal';

    // Title, remediation and message arrive already rendered in the request locale.
    title?: string;
    remediation?: string;
    message?: string;
    message_id: string;
    details?: Record<string, string>;
    first_seen_at: number;
    last_seen_at: number;
    state_since: number;
    muted_at?: number;
    muted_by?: string;
};

// Severity, state and area filtering happen client-side over the fetched list; only the mute
// read-policy is a server parameter. Omitting muted returns unmuted findings only.
export type HealthFindingFilter = {
    muted?: 'included' | 'only';
};

export type HealthState = {
    findings: Record<string, HealthFinding>;
};
