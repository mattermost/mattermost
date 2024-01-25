// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import SectionNotice from 'components/section_notice';

const NoCommonTeamsError = (): JSX.Element => {
    const intl = useIntl();
    return (
        <SectionNotice
            title={intl.formatMessage({
                id: 'sidebar_left.sidebar_channel_modal.no_common_teams_error.heading',
                defaultMessage: 'Unable to convert to a channel because group members are part of different teams',
            })}
            text={intl.formatMessage({
                id: 'sidebar_left.sidebar_channel_modal.no_common_teams_error.body',
                defaultMessage: 'Group Message cannot be converted to a channel because members are not a part of the same team. Add all members to a single team to convert this group message to a channel in that team.',
            })}
            type={'danger'}
        />
    );
};

export default NoCommonTeamsError;
