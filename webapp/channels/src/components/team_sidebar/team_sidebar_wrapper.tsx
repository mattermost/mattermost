// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {isGuildedLayoutEnabled} from 'selectors/views/guilded_layout';

import GuildedTeamSidebar from 'components/guilded_team_sidebar';

import ConnectedTeamSidebar from './connected_team_sidebar';

/**
 * TeamSidebarWrapper conditionally renders either:
 * - GuildedTeamSidebar when Guilded layout is enabled (always visible, even with 1 team)
 * - Standard TeamSidebar when Guilded layout is disabled (only visible with 2+ teams)
 */
export default function TeamSidebarWrapper() {
    const isGuilded = useSelector(isGuildedLayoutEnabled);

    if (isGuilded) {
        return <GuildedTeamSidebar />;
    }

    return <ConnectedTeamSidebar />;
}
