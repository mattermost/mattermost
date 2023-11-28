// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import AccessTab from './team_access_section';
import InfoTab from './team_info_section';

// todo sinan: check the behavior for saving 
// https://mattermost.atlassian.net/wiki/spaces/GLOAB/pages/2281046017/Settings+Revamp#Behavior-for-Saving-Settings
type Props = {
    activeTab: string;
    closeModal: () => void;
    team?: Team;
};

const TeamSettings = ({
    activeTab = '',
    closeModal,
    team,
}: Props): JSX.Element | null => {
    if (!team) {
        return null;
    }

    let result;
    switch (activeTab) {
    case 'info':
        result = <InfoTab team={team}/>;
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
