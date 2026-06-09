// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

type Props = {
    teamId: string;
    handleRemoveUserFromTeam: (team: string) => void;
}

const RemoveFromTeamButton = ({teamId, handleRemoveUserFromTeam}: Props) => {
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        handleRemoveUserFromTeam(teamId);
    };

    return (
        <Button
            type='button'
            variant='destructive'
            onClick={handleClick}
        >
            <FormattedMessage
                id='team_members_dropdown.leave_team'
                defaultMessage='Remove from Team'
            />
        </Button>
    );
};

export default RemoveFromTeamButton;
