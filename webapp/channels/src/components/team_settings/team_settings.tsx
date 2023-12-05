// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import AccessTab from './team_access_tab';
import InfoTab from './team_info_tab';

// todo sinan: check the behavior for saving
// https://mattermost.atlassian.net/wiki/spaces/GLOAB/pages/2281046017/Settings+Revamp#Behavior-for-Saving-Settings
type Props = {
    activeTab: string;
    hasChanges: boolean;
    hasChangesError: boolean;
    closeModal: () => void;
    setHasChanges: (hasChanges: boolean) => void;
    setHasChangesError: (hasChangesError: boolean) => void;
    team?: Team;
};

const TeamSettings = ({
    activeTab = '',
    closeModal,
    team,
    hasChanges,
    hasChangesError,
    setHasChanges,
    setHasChangesError,
}: Props): JSX.Element | null => {
    if (!team) {
        return null;
    }

    // todo sinan check inactive section background color
    let result;
    switch (activeTab) {
    case 'info':
        result = (
            <InfoTab
                team={team}
                hasChanges={hasChanges}
                setHasChanges={setHasChanges}
                hasChangesError={hasChangesError}
                setHasChangesError={setHasChangesError}
            />
        );
        break;
    case 'access':
        result = (
            <AccessTab
                team={team}
                closeModal={closeModal}
            />
        );
        break;
    default:
        result = (
            <div/>
        );
        break;
    }

    return result;
};

export default TeamSettings;
