// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {PropertyValue} from '@mattermost/types/properties';

import {usePropertyCardViewTeamLoader} from 'components/common/hooks/usePropertyCardViewTeamLoader';
import type {TeamFieldMetadata} from 'components/properties_card_view/properties_card_view';
import {TeamIcon} from 'components/widgets/team_icon/team_icon';

import {imageURLForTeam} from 'utils/utils';

import './team_property_renderer.scss';

type Props = {
    value: PropertyValue<unknown>;
    metadata?: TeamFieldMetadata;
}

export default function TeamPropertyRenderer({value, metadata}: Props) {
    const intl = useIntl();
    const teamId = value.value as string;
    const team = usePropertyCardViewTeamLoader(teamId, metadata?.getTeam);

    return (
        <div
            className='TeamPropertyRenderer'
            data-testid='team-property'
        >
            {
                team &&
                <>
                    <TeamIcon
                        size='xxs'
                        content={team.display_name}
                        intl={intl}
                        url={imageURLForTeam(team)}
                    />

                    {team.display_name}
                </>
            }

            {
                !team &&
                <FormattedMessage
                    id='post_card.channel_property.deleted_team'
                    defaultMessage='Deleted team ID: {teamId}'
                    values={{teamId}}
                />
            }
        </div>
    );
}
