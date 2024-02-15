// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getCloudCustomer} from 'mattermost-redux/actions/cloud';
import {getCloudErrors} from 'mattermost-redux/selectors/entities/cloud';

import {pageVisited} from 'actions/telemetry_actions';

import CloudFetchError from 'components/cloud_fetch_error';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import CompanyInfoDisplay from './company_info_display';

type Props = Record<string, never>;

const messages = defineMessages({
    title: {id: 'admin.billing.company_info.title', defaultMessage: 'Company Information'},
});

export const searchableStrings = [
    messages.title,
];

const CompanyInfo: React.FC<Props> = () => {
    const dispatch = useDispatch();
    const {customer: customerError} = useSelector(getCloudErrors);

    useEffect(() => {
        dispatch(getCloudCustomer());

        pageVisited('cloud_admin', 'pageview_billing_company_info');
    }, []);

    return (
        <div className='wrapper--fixed CompanyInfo'>
            <AdminHeader>
                <FormattedMessage {...messages.title}/>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    {customerError ? <CloudFetchError/> : <CompanyInfoDisplay/>}
                </div>
            </div>
        </div>
    );
};

export default CompanyInfo;
