// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import AccessTab from './team_access_tab';
import InfoTab from './team_info_tab';

type Props = {
    activeTab: string;
    areThereUnsavedChanges: boolean;
    showTabSwitchError: boolean;
    setAreThereUnsavedChanges: (unsaved: boolean) => void;
    setShowTabSwitchError: (error: boolean) => void;
    team?: Team;
};

const TeamSettings = ({
    activeTab = '',
    team,
    areThereUnsavedChanges,
    showTabSwitchError,
    setAreThereUnsavedChanges,
    setShowTabSwitchError,
}: Props) => {
    if (!team) {
        return null;
    }

    let result;
    switch (activeTab) {
    case 'info':
        result = (
            <InfoTab
                team={team}
                areThereUnsavedChanges={areThereUnsavedChanges}
                setAreThereUnsavedChanges={setAreThereUnsavedChanges}
                showTabSwitchError={showTabSwitchError}
                setShowTabSwitchError={setShowTabSwitchError}
            />
        );
        break;
    case 'access':
        result = (
            <AccessTab
                team={team}
                areThereUnsavedChanges={areThereUnsavedChanges}
                setAreThereUnsavedChanges={setAreThereUnsavedChanges}
                showTabSwitchError={showTabSwitchError}
                setShowTabSwitchError={setShowTabSwitchError}
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
