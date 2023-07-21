// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Audit} from '@mattermost/types/audits';
import {GlobalState} from '@mattermost/types/store';
import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getChannelByName} from 'mattermost-redux/selectors/entities/channels';

import AuditRow from '../audit_row/audit_row';
import holders from '../holders';

import ChannelCreateDirectRow from './channel_create_direct_row';
import ChannelDefaultRow from './channel_default_row';

type Props = {
    audit: Audit;
    actionURL: string;
    showUserId: boolean;
    showIp: boolean;
    showSession: boolean;
}

export default function ChannelRow({
    audit,
    actionURL,
    showUserId,
    showIp,
    showSession,
}: Props): JSX.Element {
    const props = {
        showUserId,
        showIp,
        showSession,
    };
    const intl = useIntl();

    const channelInfo = audit.extra_info.split(' ');
    const channelNameField = channelInfo[0].split('=');

    const channelURL = channelNameField.indexOf('name') >= 0 ? channelNameField[channelNameField.indexOf('name') + 1] : '';
    const channelObj = useSelector((state: GlobalState) => getChannelByName(state, channelURL));
    const channelName = channelObj?.display_name ?? channelURL;

    switch (actionURL) {
    case '/channels/create':
        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={intl.formatMessage(holders.channelCreated, {channelName})}
                {...props}
            />
        );
    case '/channels/create_direct':
        return (
            <ChannelCreateDirectRow
                audit={audit}
                actionURL={actionURL}
                showUserId={showUserId}
                showIp={showIp}
                showSession={showSession}
                channelObj={channelObj}
            />
        );
    case '/channels/update':
        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={intl.formatMessage(holders.nameUpdated, {channelName})}
                {...props}
            />
        );
    case '/channels/update_desc': // support the old path
    case '/channels/update_header':
        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={intl.formatMessage(holders.headerUpdated, {channelName})}
                {...props}
            />
        );
    default: {
        return (
            <ChannelDefaultRow
                audit={audit}
                actionURL={actionURL}
                showUserId={showUserId}
                showIp={showIp}
                showSession={showSession}
                channelInfo={channelInfo}
                channelName={channelName}
                channelURL={channelURL}
            />
        );
    }
    }
}
