// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getInvoices} from 'mattermost-redux/actions/cloud';
import {getCloudErrors, getCloudInvoices, isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';

import {pageVisited, trackEvent} from 'actions/telemetry_actions';

import CloudFetchError from 'components/cloud_fetch_error';
import EmptyBillingHistorySvg from 'components/common/svg_images_components/empty_billing_history_svg';
import ExternalLink from 'components/external_link';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {CloudLinks, HostedCustomerLinks} from 'utils/constants';

import BillingHistoryTable from './billing_history_table';

import './billing_history.scss';

const messages = defineMessages({
    title: {id: 'admin.billing.history.title', defaultMessage: 'Billing History'},
});

export const searchableStrings = [
    messages.title,
];

interface NoBillingHistorySectionProps {
    selfHosted: boolean;
}
export const NoBillingHistorySection = (props: NoBillingHistorySectionProps) => (
    <div className='BillingHistory__noHistory'>
        <EmptyBillingHistorySvg
            width={300}
            height={210}
        />
        <div className='BillingHistory__noHistory-message'>
            <FormattedMessage
                id='admin.billing.history.noBillingHistory'
                defaultMessage='In the future, this is where your billing history will show.'
            />
        </div>
        <ExternalLink
            data-testid='billingHistoryLink'
            location='billing_history'
            href={props.selfHosted ? HostedCustomerLinks.SELF_HOSTED_BILLING : CloudLinks.BILLING_DOCS}
            className='BillingHistory__noHistory-link'
            onClick={() => trackEvent('cloud_admin', 'click_billing_history', {screen: 'billing'})}
        >
            <FormattedMessage
                id='admin.billing.history.seeHowBillingWorks'
                defaultMessage='See how billing works'
            />
        </ExternalLink>
    </div>
);

const BillingHistory = () => {
    const dispatch = useDispatch();
    const isCloud = useSelector(isCurrentLicenseCloud);
    const invoices = useSelector(getCloudInvoices);
    const {invoices: invoicesError} = useSelector(getCloudErrors);

    useEffect(() => {
        pageVisited('cloud_admin', 'pageview_billing_history');
    }, []);
    useEffect(() => {
        dispatch(getInvoices());
    }, [isCloud]);
    const billingHistoryTable = invoices && <BillingHistoryTable invoices={invoices}/>;
    const areInvoicesEmpty = Object.keys(invoices || {}).length === 0;

    return (
        <div className='wrapper--fixed BillingHistory'>
            <AdminHeader>
                <FormattedMessage
                    {...messages.title}
                />
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    {invoicesError && <CloudFetchError/>}
                    {!invoicesError && <div className='BillingHistory__card'>
                        <div className='BillingHistory__cardHeader'>
                            <div className='BillingHistory__cardHeaderText'>
                                <div className='BillingHistory__cardHeaderText-top'>
                                    <FormattedMessage
                                        id='admin.billing.history.transactions'
                                        defaultMessage='Transactions'
                                    />
                                </div>
                                <div
                                    data-testid='no-invoices'
                                    className='BillingHistory__cardHeaderText-bottom'
                                >
                                    <FormattedMessage
                                        id='admin.billing.history.allPaymentsShowHere'
                                        defaultMessage='All of your invoices will be shown here'
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='BillingHistory__cardBody'>
                            {invoices != null && (
                                areInvoicesEmpty ? <NoBillingHistorySection selfHosted={!isCloud}/> : billingHistoryTable
                            )}
                            {invoices == null && (
                                <div className='BillingHistory__spinner'>
                                    <LoadingSpinner/>
                                </div>
                            )}
                        </div>
                    </div>}
                </div>
            </div>
        </div>
    );
};

export default BillingHistory;
