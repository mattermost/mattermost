// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {PropertyValue} from '@mattermost/types/properties';

import {useTeam} from 'components/common/hooks/use_team';
import {TeamIcon} from 'components/widgets/team_icon/team_icon';

import {imageURLForTeam} from 'utils/utils';

import './team_property_renderer.scss';

type Props = {
    value: PropertyValue<unknown>;
}

export default function TeamPropertyRenderer({value}: Props) {
    const intl = useIntl();

    const teamId = value.value as string;
    const team = useTeam(teamId);

    if (!team) {
        // TODO display a placeholder here in case of deleted channel
        return null;
    }

    return (
        <div className='TeamPropertyRenderer'>
            <TeamIcon
                size='xxs'
                content={team.display_name}
                intl={intl}
                url={imageURLForTeam(team)}
            />

            {team.display_name}
        </div>
    );
}
