// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Audit} from '@mattermost/types/audits';

import {toTitleCase} from 'utils/utils';

import AuditRow from './audit_row/audit_row';
import ChannelRow from './channel_row/channel_row';
import holders from './holders';
import UserRow from './user_row/user_row';

export type Props = {
    audit: Audit;
    showUserId: boolean;
    showIp: boolean;
    showSession: boolean;
}

export default function FormatAudit({
    audit,
    showUserId,
    showIp,
    showSession,
}: Props) {
    const intl = useIntl();
    const actionURL = audit.action.replace(/\/api\/v[1-9]/, '');

    if (actionURL.indexOf('/channels') === 0) {
        return (
            <ChannelRow
                audit={audit}
                actionURL={actionURL}
                showUserId={showUserId}
                showIp={showIp}
                showSession={showSession}
            />
        );
    }

    if (actionURL.indexOf('/users') === 0) {
        return (
            <UserRow
                audit={audit}
                actionURL={actionURL}
                showUserId={showUserId}
                showIp={showIp}
                showSession={showSession}
            />
        );
    }

    const {formatMessage} = intl;
    let auditDesc = '';

    if (actionURL.indexOf('/oauth') === 0) {
        const oauthInfo = audit.extra_info.split(' ');

        switch (actionURL) {
        case '/oauth/register': {
            const clientIdField = oauthInfo[0].split('=');

            if (clientIdField[0] === 'client_id') {
                auditDesc = formatMessage(holders.attemptedRegisterApp, {id: clientIdField[1]});
            }

            break;
        }
        case '/oauth/allow':
            if (oauthInfo[0] === 'attempt') {
                auditDesc = formatMessage(holders.attemptedAllowOAuthAccess);
            } else if (oauthInfo[0] === 'success') {
                auditDesc = formatMessage(holders.successfullOAuthAccess);
            } else if (oauthInfo[0] === 'fail - redirect_uri did not match registered callback') {
                auditDesc = formatMessage(holders.failedOAuthAccess);
            }

            break;
        case '/oauth/access_token':
            if (oauthInfo[0] === 'attempt') {
                auditDesc = formatMessage(holders.attemptedOAuthToken);
            } else if (oauthInfo[0] === 'success') {
                auditDesc = formatMessage(holders.successfullOAuthToken);
            } else {
                const oauthTokenFailure = oauthInfo[0].split('-');

                if (oauthTokenFailure[0].trim() === 'fail' && oauthTokenFailure[1]) {
                    auditDesc = formatMessage(holders.oauthTokenFailed, {token: oauthTokenFailure[1].trim()});
                }
            }

            break;
        default:
            break;
        }
    } else if (actionURL.indexOf('/hooks') === 0) {
        const webhookInfo = audit.extra_info;

        switch (actionURL) {
        case '/hooks/incoming/create':
            if (webhookInfo === 'attempt') {
                auditDesc = formatMessage(holders.attemptedWebhookCreate);
            } else if (webhookInfo === 'success') {
                auditDesc = formatMessage(holders.succcessfullWebhookCreate);
            } else if (webhookInfo === 'fail - bad channel permissions') {
                auditDesc = formatMessage(holders.failedWebhookCreate);
            }

            break;
        case '/hooks/incoming/delete':
            if (webhookInfo === 'attempt') {
                auditDesc = formatMessage(holders.attemptedWebhookDelete);
            } else if (webhookInfo === 'success') {
                auditDesc = formatMessage(holders.successfullWebhookDelete);
            } else if (webhookInfo === 'fail - inappropriate conditions') {
                auditDesc = formatMessage(holders.failedWebhookDelete);
            }

            break;
        default:
            break;
        }
    } else if (actionURL.indexOf('/license') === 0) {
        const licenseInfo = audit.extra_info;

        switch (actionURL) {
        case '/license/add':
            if (licenseInfo === 'attempt') {
                auditDesc = formatMessage(holders.attemptedLicenseAdd);
            } else if (licenseInfo === 'success') {
                auditDesc = formatMessage(holders.successfullLicenseAdd);
            } else if (licenseInfo === 'failed - expired or non-started license') {
                auditDesc = formatMessage(holders.failedExpiredLicenseAdd);
            } else if (licenseInfo === 'failed - invalid license') {
                auditDesc = formatMessage(holders.failedInvalidLicenseAdd);
            }

            break;
        case '/license/remove':
            auditDesc = formatMessage(holders.licenseRemoved);
            break;
        default:
            break;
        }
    } else if (actionURL.indexOf('/admin/download_compliance_report') === 0) {
        auditDesc = toTitleCase(audit.extra_info);
    } else {
        switch (actionURL) {
        case '/logout':
            auditDesc = formatMessage(holders.logout);
            break;
        case '/verify_email':
            auditDesc = formatMessage(holders.verified);
            break;
        default:
            break;
        }
    }

    return (
        <AuditRow
            audit={audit}
            desc={auditDesc}
            actionURL={actionURL}
            showUserId={showUserId}
            showIp={showIp}
            showSession={showSession}
        />
    );
}
