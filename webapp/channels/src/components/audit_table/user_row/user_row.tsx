// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {Audit} from '@mattermost/types/audits';

import holders from '../holders';
import AuditRow from '../audit_row/audit_row';

import UserUpdateActiveSessionRow from './user_update_active_session_row';

type Props = {
    audit: Audit;
    actionURL: string;
    showUserId: boolean;
    showIp: boolean;
    showSession: boolean;
}

export default function UserRow({
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

    const userInfo = audit.extra_info.split(' ');

    let desc = '';
    switch (actionURL) {
    case '/users/login':
        if (userInfo[0] === 'attempt') {
            desc = intl.formatMessage(holders.attemptedLogin);
        } else if (userInfo[0] === 'success') {
            desc = intl.formatMessage(holders.successfullLogin);
        } else if (userInfo[0] === 'authenticated') {
            desc = intl.formatMessage(holders.authenticated);
        } else if (userInfo[0]) {
            desc = intl.formatMessage(holders.failedLogin);
        }

        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={desc}
                {...props}
            />
        );
    case '/users/revoke_session':
        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={intl.formatMessage(holders.sessionRevoked, {
                    sessionId: userInfo[0].split('=')[1],
                })}
                {...props}
            />
        );
    case '/users/newimage':
        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={intl.formatMessage(holders.updatePicture)}
                {...props}
            />
        );
    case '/users/update':
        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={intl.formatMessage(holders.updateGeneral)}
                {...props}
            />
        );
    case '/users/newpassword':
        if (userInfo[0] === 'attempted') {
            desc = intl.formatMessage(holders.attemptedPassword);
        } else if (userInfo[0] === 'completed') {
            desc = intl.formatMessage(holders.successfullPassword);
        } else if (
            userInfo[0] ===
                'failed - tried to update user password who was logged in through oauth'
        ) {
            desc = intl.formatMessage(holders.failedPassword);
        }

        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={intl.formatMessage(holders.updateGeneral)}
                {...props}
            />
        );
    case '/users/update_roles': {
        const userRoles = userInfo[0].split('=')[1];

        desc = intl.formatMessage(holders.updatedRol);
        if (userRoles.trim()) {
            desc += userRoles;
        } else {
            desc += intl.formatMessage(holders.member);
        }

        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={desc}
                {...props}
            />
        );
    }
    case '/users/update_active': {
        const updateType = userInfo[0].split('=')[0];
        const updateField = userInfo[0].split('=')[1];

        /* Either describes account activation/deactivation or a revoked session as part of an account deactivation */
        if (updateType === 'active') {
            return (
                <UserUpdateActiveSessionRow
                    audit={audit}
                    actionURL={actionURL}
                    showUserId={showUserId}
                    showIp={showIp}
                    showSession={showSession}
                    updateField={updateField}
                    userInfo={userInfo}
                />
            );
        } else if (updateType === 'session_id') {
            desc = intl.formatMessage(holders.sessionRevoked, {
                sessionId: updateField,
            });
        }

        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={desc}
                {...props}
            />
        );
    }
    case '/users/send_password_reset':
        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={intl.formatMessage(holders.sentEmail, {
                    email: userInfo[0].split('=')[1],
                })}
                {...props}
            />
        );
    case '/users/reset_password':
        if (userInfo[0] === 'attempt') {
            desc = intl.formatMessage(holders.attemptedReset);
        } else if (userInfo[0] === 'success') {
            desc = intl.formatMessage(holders.successfullReset);
        }

        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={desc}
                {...props}
            />
        );
    case '/users/update_notify':
        return (
            <AuditRow
                audit={audit}
                actionURL={actionURL}
                desc={intl.formatMessage(holders.updateGlobalNotifications)}
                {...props}
            />
        );
    default:
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
}
