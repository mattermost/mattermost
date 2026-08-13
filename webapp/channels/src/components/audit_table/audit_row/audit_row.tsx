// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedDate, FormattedTime, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Audit} from '@mattermost/types/audits';
import type {GlobalState} from '@mattermost/types/store';

import {getUser} from 'mattermost-redux/selectors/entities/users';

import {toTitleCase} from 'utils/utils';

import './audit_row.scss';

import holders from '../holders';

export type Props = {
    audit: Audit;
    actionURL: string;
    desc?: string;
    showUserId: boolean;
    showIp: boolean;
    showSession: boolean;
};

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
        uContent = <td>{userId}</td>;
    }

    let iContent;
    if (showIp) {
        iContent = (
            <td>
                {ip}
            </td>
        );
    }

    let sContent;
    if (showSession) {
        sContent = (
            <td>
                {sessionId}
            </td>
        );
    }

    return (
        <tr className='AuditRow'>
            <td>
                {timestamp}
            </td>
            {uContent}
            <td
                className={classNames('AuditRowDesc', {
                    'AuditRowDesc--error': desc.toLowerCase().indexOf('fail') !== -1,
                })}
            >{desc}</td>
            {iContent}
            {sContent}
        </tr>
    );
}
