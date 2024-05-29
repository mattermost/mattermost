// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Audit} from '@mattermost/types/audits';
import type {GlobalState} from '@mattermost/types/store';

import {getCurrentUser, getUser} from 'mattermost-redux/selectors/entities/users';
import {isSystemAdmin} from 'mattermost-redux/utils/user_utils';

import AuditRow from '../audit_row/audit_row';
import holders from '../holders';

type Props = {
    audit: Audit;
    actionURL: string;
    showUserId: boolean;
    showIp: boolean;
    showSession: boolean;
    updateField: string;
    userInfo: string[];
}

export default function UserUpdateActiveSessionRow({
    audit,
    actionURL,
    showUserId,
    showIp,
    showSession,
    updateField,
    userInfo,
}: Props): JSX.Element {
    const intl = useIntl();

    let desc = '';

    if (updateField === 'true') {
        desc = intl.formatMessage(holders.accountActive);
    } else if (updateField === 'false') {
        desc = intl.formatMessage(holders.accountInactive);
    }

    const actingUserInfo = userInfo[1].split('=');
    const isSessionUser = actingUserInfo[0] === 'session_user';
    const actingUser = useSelector((state: GlobalState) => getUser(state, isSessionUser ? actingUserInfo[1] : ''));
    const user = useSelector((state: GlobalState) => getCurrentUser(state));
    if (isSessionUser) {
        if (user && actingUser && isSystemAdmin(user.roles)) {
            desc += intl.formatMessage(holders.by, {
                username: actingUser.username,
            });
        } else if (user && actingUser) {
            desc += intl.formatMessage(holders.byAdmin);
        }
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
