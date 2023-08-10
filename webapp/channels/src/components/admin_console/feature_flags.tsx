// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import type {AdminConfig} from '@mattermost/types/config';

type Props = {
    config: AdminConfig;
};

const FeatureFlags: React.FC<Props> = (props: Props) => {
    const flags = props.config.FeatureFlags;
    let settings = null;
    if (flags) {
        settings = Object.keys(flags).map((ffKey) => (
            <tr key={ffKey}>
                <td width='20px'/>
                <td className='whitespace--nowrap'>{ffKey}</td>
                <td className='whitespace--nowrap'>{String(flags[ffKey])}</td>
            </tr>
        ));
    }

    return (
        <div className='wrapper--admin'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.feature_flags.title'
                    defaultMessage='Features Flags'
                />
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-logs-content admin-console__content'>
                    <div className={'banner info'}>
                        <div className='banner__content'>
                            <FormattedMessage
                                id='admin.feature_flags.introBanner'
                                defaultMessage={'Feature flag values displayed here show the status of features enabled on this server. The values here are used only for troubleshooting by the Mattermost support team.'}
                            />
                        </div>
                    </div>
                    <div className='job-table__panel'>
                        <div className='job-table__table'>
                            <table
                                className='table'
                            >
                                <thead>
                                    <tr>
                                        <th/>
                                        <th>
                                            <FormattedMessage
                                                id='admin.feature_flags.flag'
                                                defaultMessage='Flag'
                                            />
                                        </th>
                                        <th>
                                            <FormattedMessage
                                                id='admin.feature_flags.flag_value'
                                                defaultMessage='Value'
                                            />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {settings}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeatureFlags;
