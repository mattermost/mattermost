// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import Tooltip from 'components/tooltip';

const TitleTooltip = (props: ComponentProps<typeof Tooltip>) => {
    return (
        <Tooltip
            {...props}
            id={'activated_user_title_tooltip'}
        >
            <span className='analytics_tooltip_header'>
                <FormattedMessage
                    id={'analytics.team.totalUsers.title.tooltip.header'}
                    defaultMessage={'Users who have an account on this server'}
                />
            </span>
            <br/>
            <span className='analytics_tooltip_body'>
                <FormattedMessage
                    id={'analytics.team.totalUsers.title.tooltip.body'}
                    defaultMessage={'Also called "Registered Users"'}
                />
            </span>
        </Tooltip>
    );
};

export default TitleTooltip;
