// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useIntl} from 'react-intl';

import {useSelector} from 'react-redux';

import {Audit} from '@mattermost/types/audits';
import {GlobalState} from '@mattermost/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import AuditRow from '../audit_row/audit_row';
import holders from '../holders';

type Props = {
    audit: Audit;
    actionURL: string;
    showUserId: boolean;
    showIp: boolean;
    showSession: boolean;
    channelInfo: string[];
    channelName: string;
    channelURL: string;
};

export default function ChannelDefaultRow({
    audit,
    actionURL,
    showUserId,
    showIp,
    showSession,
    channelInfo,
    channelName,
    channelURL,
}: Props) {
    const intl = useIntl();

    let userIdField = [];
    let userId = '';
    let username = '';

    if (channelInfo[1]) {
        userIdField = channelInfo[1].split('=');

        if (userIdField.indexOf('user_id') >= 0) {
            userId = userIdField[userIdField.indexOf('user_id') + 1];
        }
    }

    const profile = useSelector((state: GlobalState) => getUser(state, userId));
    if (profile) {
        username = profile.username;
    }

    let desc = '';
    if ((/\/channels\/[A-Za-z0-9]+\/delete/).test(actionURL)) {
        desc = intl.formatMessage(holders.channelDeleted, {url: channelURL});
    } else if ((/\/channels\/[A-Za-z0-9]+\/add/).test(actionURL)) {
        desc = intl.formatMessage(holders.userAdded, {username, channelName});
    } else if ((/\/channels\/[A-Za-z0-9]+\/remove/).test(actionURL)) {
        desc = intl.formatMessage(holders.userRemoved, {
            username,
            channelName,
        });
    }

    return (
        <AuditRow
            audit={audit}
            actionURL={actionURL}
            desc={desc}
            showUserId={showUserId}
            showIp={showIp}
            showSession={showSession}
        />
    );
}
