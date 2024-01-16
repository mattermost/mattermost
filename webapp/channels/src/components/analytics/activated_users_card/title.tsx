// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, defineMessages, useIntl} from 'react-intl';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';

import ExternalLink from 'components/external_link';
import OverlayTrigger from 'components/overlay_trigger';
import {createTooltip} from 'components/tooltip';

import Constants from 'utils/constants';

export const messages = defineMessages({
    totalUsers: {id: 'analytics.team.totalUsers', defaultMessage: 'Total Activated Users'},
});

const TitleTooltip = createTooltip({
    id: 'activated_user_title_tooltip',
    title: defineMessage({id: 'analytics.team.totalUsers.title.tooltip.title', defaultMessage: 'Activated users on this server'}),
    hint: defineMessage({id: 'analytics.team.totalUsers.title.tooltip.hint', defaultMessage: 'Also called Registered Users'}),
});

const Title = () => {
    const intl = useIntl();
    return (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='top'
            overlay={<TitleTooltip/>}
        >
            <span>
                <ExternalLink href='https://docs.mattermost.com/configure/reporting-configuration-settings.html#site-statistics'>
                    {intl.formatMessage(messages.totalUsers)}
                    <InformationOutlineIcon size='16'/>
                </ExternalLink>
            </span>
        </OverlayTrigger>
    );
};

export default Title;
