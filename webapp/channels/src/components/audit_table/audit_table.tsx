// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {Audit} from '@mattermost/types/audits';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionFunc} from 'mattermost-redux/types/actions';

import FormatAudit from './format_audit';

type Props = {
    intl: IntlShape;
    audits: Audit[];
    showUserId?: boolean;
    showIp?: boolean;
    showSession?: boolean;
    currentUser: UserProfile;
    actions: {
        getMissingProfilesByIds: (userIds: string[]) => ActionFunc;
    };
};

export class AuditTable extends React.PureComponent<Props> {
    componentDidMount() {
        const ids = this.props.audits.map((audit) => audit.user_id);
        this.props.actions.getMissingProfilesByIds(ids);
    }

    render() {
        const {audits, showUserId, showIp, showSession} = this.props;

        let userIdContent;
        if (showUserId) {
            userIdContent = (
                <th>
                    <FormattedMessage
                        id='audit_table.userId'
                        defaultMessage='User ID'
                    />
                </th>
            );
        }

        let ipContent;
        if (showIp) {
            ipContent = (
                <th>
                    <FormattedMessage
                        id='audit_table.ip'
                        defaultMessage='IP Address'
                    />
                </th>
            );
        }

        let sessionContent;
        if (showSession) {
            sessionContent = (
                <th>
                    <FormattedMessage
                        id='audit_table.session'
                        defaultMessage='Session ID'
                    />
                </th>
            );
        }

        return (
            <table className='table'>
                <thead>
                    <tr>
                        <th>
                            <FormattedMessage
                                id='audit_table.timestamp'
                                defaultMessage='Timestamp'
                            />
                        </th>
                        {userIdContent}
                        <th>
                            <FormattedMessage
                                id='audit_table.action'
                                defaultMessage='Action'
                            />
                        </th>
                        {ipContent}
                        {sessionContent}
                    </tr>
                </thead>
                <tbody data-testid='auditTableBody'>
                    {audits.map((audit) => (
                        <FormatAudit
                            key={audit.id}
                            audit={audit}
                            showUserId={Boolean(this.props.showUserId)}
                            showIp={Boolean(this.props.showIp)}
                            showSession={Boolean(this.props.showSession)}
                        />
                    ))}
                </tbody>
            </table>
        );
    }
}

export default injectIntl(AuditTable);
