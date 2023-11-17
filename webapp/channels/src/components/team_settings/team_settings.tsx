// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import AccessTab from './team_access_tab';
import GeneralTab from './team_info_tab';

// todo sinan: why it is scrolled down in the sections
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
        result = (
            <div>
                <GeneralTab
                    team={team}
                    closeModal={closeModal}
                />
            </div>
        );
        break;
    case 'access':
        result = (
            <div>
                <AccessTab
                    team={team}
                    closeModal={closeModal}
                />
            </div>
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
