// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedDate, FormattedTime, useIntl} from 'react-intl';

import {useSelector} from 'react-redux';

import {Audit} from '@mattermost/types/audits';

import holders from '../holders';
import {toTitleCase} from 'utils/utils';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from '@mattermost/types/store';

export type Props = {
    audit: Audit;
    actionURL: string;
    desc?: string;
    showUserId: boolean;
    showIp: boolean;
    showSession: boolean;
}

export default function AuditRow({
    actionURL,
    audit,
    desc: aDesc,
    showUserId,
    showIp,
    showSession,
}: Props) {
    const intl = useIntl();
    let desc = aDesc;
    if (!desc) {
        /* Currently not called anywhere */
        if (audit.extra_info.indexOf('revoked_all=') >= 0) {
            desc = intl.formatMessage(holders.revokedAll);
        } else {
            let actionDesc = '';
            if (actionURL && actionURL.lastIndexOf('/') !== -1) {
                actionDesc = actionURL.substring(actionURL.lastIndexOf('/') + 1).replace('_', ' ');
                actionDesc = toTitleCase(actionDesc);
            }

            let extraInfoDesc = '';
            if (audit.extra_info) {
                extraInfoDesc = audit.extra_info;

                if (extraInfoDesc.indexOf('=') !== -1) {
                    extraInfoDesc = extraInfoDesc.substring(extraInfoDesc.indexOf('=') + 1);
                }
            }
            desc = actionDesc + ' ' + extraInfoDesc;
        }
    }

    const date = new Date(audit.create_at);
    const timestamp = (
        <div>
            <div>
                <FormattedDate
                    value={date}
                    day='2-digit'
                    month='short'
                    year='numeric'
                />
            </div>
            <div>
                <FormattedTime
                    value={date}
                    hour='2-digit'
                    minute='2-digit'
                />
            </div>
        </div>
    );

    const ip = audit.ip_address;
    const sessionId = audit.session_id;

    const auditProfile = useSelector((state: GlobalState) => getUser(state, audit.user_id));
    const userId = auditProfile ? auditProfile.email : audit.user_id;
    let uContent;
    if (showUserId) {
        uContent = <td className='word-break--all'>{userId}</td>;
    }

    let iContent;
    if (showIp) {
        iContent = (
            <td className='whitespace--nowrap word-break--all'>
                {ip}
            </td>
        );
    }

    let sContent;
    if (showSession) {
        sContent = (
            <td className='whitespace--nowrap word-break--all'>
                {sessionId}
            </td>
        );
    }

    let descStyle = '';
    if (desc.toLowerCase().indexOf('fail') !== -1) {
        descStyle = ' color--error';
    }

    return (
        <tr key={audit.id}>
            <td className='whitespace--nowrap word-break--all'>
                {timestamp}
            </td>
            {uContent}
            <td className={'word-break--all' + descStyle}>{desc}</td>
            {iContent}
            {sContent}
        </tr>
    );
}
