// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, defineMessages, useIntl} from 'react-intl';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import ExternalLink from 'components/external_link';

export const messages = defineMessages({
    totalUsers: {id: 'analytics.team.totalUsers', defaultMessage: 'Total Activated Users'},
});

type TitleProps = {
    guestAccountsEnabled: boolean;
}

const Title = ({guestAccountsEnabled}: TitleProps) => {
    const intl = useIntl();
    return (
        <WithTooltip
            title={defineMessage({id: 'analytics.team.totalUsers.title.tooltip.title', defaultMessage: 'Activated users on this server'})}
            hint={guestAccountsEnabled ?
                defineMessage({id: 'analytics.team.totalUsers.title.tooltip.hint.withGuests', defaultMessage: 'Also called Registered Users. Excludes single-channel guests.'}) :
                defineMessage({id: 'analytics.team.totalUsers.title.tooltip.hint', defaultMessage: 'Also called Registered Users'})
            }
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
