// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {type MessageDescriptor, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {isDesktopApp} from 'utils/user_agent';

export default function usePopoutTitle(titleTemplate: MessageDescriptor, params?: Record<string, string>) {
    const intl = useIntl();
    const siteName = useSelector(getConfig).SiteName;
    const currentChannel = useSelector(getCurrentChannel);
    const currentTeam = useSelector(getCurrentTeam);

    useEffect(() => {
        if (isDesktopApp()) {
            return;
        }
        document.title = intl.formatMessage(titleTemplate, {
            serverName: siteName,
            channelName: currentChannel?.display_name,
            teamName: currentTeam?.display_name,
            ...params,
        });
    }, [currentChannel, currentTeam, intl, titleTemplate, params, siteName]);
}
