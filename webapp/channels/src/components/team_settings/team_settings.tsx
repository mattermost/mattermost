// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import AccessTab from './team_access_tab';
import InfoTab from './team_info_tab';

type Props = {
    activeTab: string;
    hasChanges: boolean;
    hasChangeTabError: boolean;
    setHasChanges: (hasChanges: boolean) => void;
    setHasChangeTabError: (hasChangesError: boolean) => void;
    closeModal: () => void;
    collapseModal: () => void;
    team?: Team;
};

const TeamSettings = ({
    activeTab = '',
    closeModal,
    collapseModal,
    team,
    hasChanges,
    hasChangeTabError,
    setHasChanges,
    setHasChangeTabError,
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
                hasChanges={hasChanges}
                setHasChanges={setHasChanges}
                hasChangeTabError={hasChangeTabError}
                setHasChangeTabError={setHasChangeTabError}
                closeModal={closeModal}
                collapseModal={collapseModal}
            />
        );
        break;
    case 'access':
        result = (
            <AccessTab
                team={team}
                hasChanges={hasChanges}
                setHasChanges={setHasChanges}
                hasChangeTabError={hasChangeTabError}
                setHasChangeTabError={setHasChangeTabError}
                closeModal={closeModal}
                collapseModal={collapseModal}
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
