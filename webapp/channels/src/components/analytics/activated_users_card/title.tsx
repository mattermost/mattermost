// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, defineMessages, useIntl} from 'react-intl';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';

import ExternalLink from 'components/external_link';
import WithTooltip from 'components/with_tooltip';

export const messages = defineMessages({
    totalUsers: {id: 'analytics.team.totalUsers', defaultMessage: 'Total Activated Users'},
});

const Title = () => {
    const intl = useIntl();
    return (
        <WithTooltip
            id='activated_user_title_tooltip'
            title={defineMessage({id: 'analytics.team.totalUsers.title.tooltip.title', defaultMessage: 'Activated users on this server'})}
            hint={defineMessage({id: 'analytics.team.totalUsers.title.tooltip.hint', defaultMessage: 'Also called Registered Users'})}
            placement='top'
        >
            <span>
                <ExternalLink
                    location='activated_users_card.title'
                    href='https://mattermost.com/pl/site-statistics-definitions'
                >
                    {intl.formatMessage(messages.totalUsers)}
                    <InformationOutlineIcon size='16'/>
                </ExternalLink>
            </span>
        </WithTooltip>
    );
};

export default Title;
