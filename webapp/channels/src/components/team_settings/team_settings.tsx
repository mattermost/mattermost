// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import GeneralTab from 'components/team_general_tab';

type Props = {
    activeTab: string;
    closeModal: () => void;
    collapseModal: () => void;
    team?: Team;
};

const TeamSettings = ({
    activeTab = '',
    closeModal,
    collapseModal,
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
                    collapseModal={collapseModal}
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
