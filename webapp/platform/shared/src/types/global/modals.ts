// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

// Plugin-facing contract for the `window.WebappUtils` API. Hand-authored, not derived:
// the web app checks at build time that each stays assignable to the real modal, so
// drift breaks the build, not plugins.

export type UserSettingsModalProps = {isContentProductSettings: boolean; userID?: string; adminMode?: boolean; activeTab?: string};
export type InvitationModalProps = {channelToInvite?: Channel; canInviteGuests?: boolean};
export type TeamSettingsModalProps = {focusOriginElement?: string};
export type TeamMembersModalProps = {onLoad?: () => void; focusOriginElement?: string};
export type LeaveTeamModalProps = Record<string, never>;

export type PublishedModalProps = {
    user_settings: UserSettingsModalProps;
    invitation: InvitationModalProps;
    team_settings: TeamSettingsModalProps;
    team_members: TeamMembersModalProps;
    leave_team: LeaveTeamModalProps;
};

export type PublishedModalId = keyof PublishedModalProps;

// A known modal id, or any string: lets a plugin feature-detect (via canOpenModalId)
// ids a running web app may not publish yet, while keeping autocomplete for known ids.
export type PublishedModalIdCandidate = PublishedModalId | (string & {});

// The modal opener utils the web app publishes on window.WebappUtils.modals.
export type PublishedModalUtils = {
    openModalById: <K extends PublishedModalId>(modalId: K, dialogProps?: PublishedModalProps[K]) => void;
    canOpenModalId: (modalId: PublishedModalIdCandidate) => boolean;
};
