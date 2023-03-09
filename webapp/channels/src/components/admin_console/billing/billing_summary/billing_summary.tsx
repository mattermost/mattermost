// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedDate, FormattedMessage, FormattedNumber} from 'react-intl';

import {useDispatch} from 'react-redux';
import {CheckCircleOutlineIcon} from '@mattermost/compass-icons/components';

import {BillingSchemes, CloudLinks, TrialPeriodDays, ModalIdentifiers} from 'utils/constants';

import BlockableLink from 'components/admin_console/blockable_link';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import UpgradeSvg from 'components/common/svg_images_components/upgrade_svg';
import EmptyBillingHistorySvg from 'components/common/svg_images_components/empty_billing_history_svg';

import {trackEvent} from 'actions/telemetry_actions';

import {Client4} from 'mattermost-redux/client';
import {Invoice, InvoiceLineItem, Product} from '@mattermost/types/cloud';
import {openModal} from 'actions/views/modals';
import CloudInvoicePreview from 'components/cloud_invoice_preview';
import ExternalLink from 'components/external_link';

export const noBillingHistory = (
    <div className='BillingSummary__noBillingHistory'>
        <EmptyBillingHistorySvg
            height={167}
            width={234}
        />
        <div className='BillingSummary__noBillingHistory-title'>
            <FormattedMessage
                id='admin.billing.subscriptions.billing_summary.noBillingHistory.title'
                defaultMessage='No billing history yet'
            />
        </div>
        <div className='BillingSummary__noBillingHistory-message'>
            <FormattedMessage
                id='admin.billing.subscriptions.billing_summary.noBillingHistory.description'
                defaultMessage='In the future, this is where your most recent bill summary will show.'
            />
        </div>
        <ExternalLink
            location='billing_summary'
            href={CloudLinks.BILLING_DOCS}
            className='BillingSummary__noBillingHistory-link'
            onClick={() => trackEvent('cloud_admin', 'click_how_billing_works', {screen: 'subscriptions'})}
        >
            <FormattedMessage
                id='admin.billing.subscriptions.billing_summary.noBillingHistory.link'
                defaultMessage='See how billing works'
            />
        </ExternalLink>
    </div>
);

export const freeTrial = (onUpgradeMattermostCloud: (callerInfo: string) => void, daysLeftOnTrial: number) => (
    <div className='UpgradeMattermostCloud'>
        <div className='UpgradeMattermostCloud__image'>
            <UpgradeSvg
                height={167}
                width={234}
            />
        </div>
        <div className='UpgradeMattermostCloud__title'>
            {daysLeftOnTrial > TrialPeriodDays.TRIAL_1_DAY &&
                <FormattedMessage
                    id='admin.billing.subscription.freeTrial.title'
                    defaultMessage={'You\'re currently on a free trial'}
                />
            }
            {(daysLeftOnTrial === TrialPeriodDays.TRIAL_1_DAY || daysLeftOnTrial === TrialPeriodDays.TRIAL_0_DAYS) &&
                <FormattedMessage
                    id='admin.billing.subscription.freeTrial.lastDay.title'
                    defaultMessage={'Your free trial ends today'}
                />
            }
        </div>
        <div className='UpgradeMattermostCloud__description'>
            {daysLeftOnTrial > TrialPeriodDays.TRIAL_WARNING_THRESHOLD &&
                <FormattedMessage
                    id='admin.billing.subscription.freeTrial.description'
                    defaultMessage='Your free trial will expire in {daysLeftOnTrial} days. Add your payment information to continue after the trial ends.'
                    values={{daysLeftOnTrial}}
                />
            }
            {(daysLeftOnTrial > TrialPeriodDays.TRIAL_1_DAY && daysLeftOnTrial <= TrialPeriodDays.TRIAL_WARNING_THRESHOLD) &&
                <FormattedMessage
                    id='admin.billing.subscription.freeTrial.lessThan3Days.description'
                    defaultMessage='Your free trial will end in {daysLeftOnTrial, number} {daysLeftOnTrial, plural, one {day} other {days}}. Add payment information to continue enjoying the benefits of Cloud Professional.'
                    values={{daysLeftOnTrial}}
                />
            }
            {(daysLeftOnTrial === TrialPeriodDays.TRIAL_1_DAY || daysLeftOnTrial === TrialPeriodDays.TRIAL_0_DAYS) &&
                <FormattedMessage
                    id='admin.billing.subscription.freeTrial.lastDay.description'
                    defaultMessage='Your free trial has ended. Add payment information to continue enjoying the benefits of Cloud Professional.'
                />
            }
        </div>
        <button
            type='button'
            onClick={() => onUpgradeMattermostCloud('billing_summary_free_trial_upgrade_button')}
            className='UpgradeMattermostCloud__upgradeButton'
        >
            <FormattedMessage
                id='admin.billing.subscription.cloudTrial.subscribeButton'
                defaultMessage='Upgrade Now'
            />
        </button>
    </div>
);

export const getPaymentStatus = (status: string) => {
    switch (status.toLowerCase()) {
    case 'failed':
        return (
            <div className='BillingSummary__lastInvoice-headerStatus failed'>
                <FormattedMessage
                    id='admin.billing.subscriptions.billing_summary.lastInvoice.failed'
                    defaultMessage='Failed'
                />
                <i className='icon icon-alert-outline'/>
            </div>
        );
    case 'paid':
        return (
            <div className='BillingSummary__lastInvoice-headerStatus paid'>
                <FormattedMessage
                    id='admin.billing.subscriptions.billing_summary.lastInvoice.paid'
                    defaultMessage='Paid'
                />
                <CheckCircleOutlineIcon/>
            </div>
        );
    default:
        return (
            <div className='BillingSummary__lastInvoice-headerStatus pending'>
                <FormattedMessage
                    id='admin.billing.subscriptions.billing_summary.lastInvoice.pending'
                    defaultMessage='Pending'
                />
                <CheckCircleOutlineIcon/>
            </div>
        );
    }
};

type InvoiceInfoProps = {
    invoice: Invoice;
    product?: Product;
    fullCharges: InvoiceLineItem[];
    partialCharges: InvoiceLineItem[];
    hasMore?: number;
}

export const InvoiceInfo = ({invoice, product, fullCharges, partialCharges, hasMore}: InvoiceInfoProps) => {
    const dispatch = useDispatch();
    const isUpcomingInvoice = invoice?.status.toLowerCase() === 'upcoming';
    const openInvoicePreview = () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.CLOUD_INVOICE_PREVIEW,
                dialogType: CloudInvoicePreview,
                dialogProps: {
                    url: Client4.getInvoicePdfUrl(invoice.id),
                },
            }),
        );
    };
    const title = () => {
        if (isUpcomingInvoice) {
            return (
                <FormattedMessage
                    id='admin.billing.subscription.invoice.next'
                    defaultMessage='Next Invoice'
                />
            );
        }
        return (
            <FormattedMessage
                id='admin.billing.subscriptions.billing_summary.lastInvoice.title'
                defaultMessage='Last Invoice'
            />
        );
    };
    return (
        <div className='BillingSummary__lastInvoice'>
            <div className='BillingSummary__lastInvoice-header'>
                <div className='BillingSummary__lastInvoice-headerTitle'>
                    {title()}
                </div>
                {getPaymentStatus(invoice.status)}
            </div>
            <div className='BillingSummary__lastInvoice-date'>
                <FormattedDate
                    value={new Date(invoice.period_start)}
                    month='short'
                    year='numeric'
                    day='numeric'
                    timeZone='UTC'
                />
            </div>
            <div className='BillingSummary__lastInvoice-productName'>
                {product?.name}
            </div>
            <hr/>
            {fullCharges.map((charge: any) => (
                <div
                    key={charge.price_id}
                    className='BillingSummary__lastInvoice-charge'
                >
                    <div className='BillingSummary__lastInvoice-chargeDescription'>
                        {product?.billing_scheme === BillingSchemes.FLAT_FEE ? (
                            <FormattedMessage
                                id='admin.billing.subscriptions.billing_summary.lastInvoice.monthlyFlatFee'
                                defaultMessage='Monthly Flat Fee'
                            />
                        ) : (
                            <>
                                <FormattedNumber
                                    value={charge.price_per_unit / 100.0}
                                    // eslint-disable-next-line react/style-prop-object
                                    style='currency'
                                    currency='USD'
                                />
                                <FormattedMessage
                                    id='admin.billing.subscriptions.billing_summary.lastInvoice.userCount'
                                    defaultMessage=' x {users} users'
                                    values={{users: charge.quantity}}
                                />
                            </>
                        )}
                    </div>
                    <div className='BillingSummary__lastInvoice-chargeAmount'>
                        <FormattedNumber
                            value={charge.total / 100.0}
                            // eslint-disable-next-line react/style-prop-object
                            style='currency'
                            currency='USD'
                        />
                    </div>
                </div>
            ))}
            {Boolean(hasMore) && (
                <div
                    className='BillingSummary__lastInvoice-hasMoreItems'
                >
                    <div
                        onClick={openInvoicePreview}
                        className='BillingSummary__lastInvoice-chargeDescription'
                    >
                        {product?.billing_scheme === BillingSchemes.FLAT_FEE ? (
                            <FormattedMessage
                                id='admin.billing.subscriptions.billing_summary.lastInvoice.monthlyFlatFee'
                                defaultMessage='Monthly Flat Fee'
                            />
                        ) : (
                            <>
                                <FormattedMessage
                                    id='admin.billing.subscriptions.billing_summary.upcomingInvoice.has_more_line_items'
                                    defaultMessage='And {count} more items'
                                    values={{count: hasMore}}
                                />
                            </>
                        )}
                    </div>
                </div>
            )}
            {Boolean(partialCharges.length) && (
                <>
                    <div className='BillingSummary__lastInvoice-partialCharges'>
                        <FormattedMessage
                            id='admin.billing.subscriptions.billing_summary.lastInvoice.partialCharges'
                            defaultMessage='Partial charges'
                        />
                        <OverlayTrigger
                            delayShow={500}
                            placement='bottom'
                            overlay={
                                <Tooltip
                                    id='BillingSubscriptions__seatOverageTooltip'
                                    className='BillingSubscriptions__tooltip BillingSubscriptions__tooltip-right'
                                    positionLeft={390}
                                >
                                    <div className='BillingSubscriptions__tooltipTitle'>
                                        <FormattedMessage
                                            id='admin.billing.subscriptions.billing_summary.lastInvoice.whatArePartialCharges'
                                            defaultMessage='What are partial charges?'
                                        />
                                    </div>
                                    <div className='BillingSubscriptions__tooltipMessage'>
                                        <FormattedMessage
                                            id='admin.billing.subscriptions.billing_summary.lastInvoice.whatArePartialCharges.message'
                                            defaultMessage='Users who have not been enabled for the full duration of the month are charged at a prorated monthly rate.'
                                        />
                                    </div>
                                </Tooltip>
                            }
                        >
                            <i className='icon-information-outline'/>
                        </OverlayTrigger>
                    </div>
                    {partialCharges.map((charge: any) => (
                        <div
                            key={charge.price_id}
                            className='BillingSummary__lastInvoice-charge'
                        >
                            <div className='BillingSummary__lastInvoice-chargeDescription'>
                                <FormattedMessage
                                    id='admin.billing.subscriptions.billing_summary.lastInvoice.userCountPartial'
                                    defaultMessage='{users} users'
                                    values={{users: charge.quantity}}
                                />
                            </div>
                            <div className='BillingSummary__lastInvoice-chargeAmount'>
                                <FormattedNumber
                                    value={charge.total / 100.0}
                                    // eslint-disable-next-line react/style-prop-object
                                    style='currency'
                                    currency='USD'
                                />
                            </div>
                        </div>
                    ))}
                </>
            )}
            {Boolean(invoice.tax) && (
                <div className='BillingSummary__lastInvoice-charge'>
                    <div className='BillingSummary__lastInvoice-chargeDescription'>
                        <FormattedMessage
                            id='admin.billing.subscriptions.billing_summary.lastInvoice.taxes'
                            defaultMessage='Taxes'
                        />
                    </div>
                    <div className='BillingSummary__lastInvoice-chargeAmount'>
                        <FormattedNumber
                            value={invoice.tax / 100.0}
                            // eslint-disable-next-line react/style-prop-object
                            style='currency'
                            currency='USD'
                        />
                    </div>
                </div>
            )}
            <hr/>
            <div className='BillingSummary__lastInvoice-charge total'>
                <div className='BillingSummary__lastInvoice-chargeDescription'>
                    <FormattedMessage
                        id='admin.billing.subscriptions.billing_summary.lastInvoice.total'
                        defaultMessage='Total'
                    />
                </div>
                <div className='BillingSummary__lastInvoice-chargeAmount'>
                    <FormattedNumber
                        value={invoice.total / 100.0}
                        // eslint-disable-next-line react/style-prop-object
                        style='currency'
                        currency='USD'
                    />
                </div>
            </div>
            <div className='BillingSummary__lastInvoice-download'>
                <button
                    onClick={openInvoicePreview}
                    className='BillingSummary__lastInvoice-downloadButton btn btn-primary'
                >
                    <i className='icon icon-file-pdf-outline'/>
                    <FormattedMessage
                        id='admin.billing.subscriptions.billing_summary.lastInvoice.viewInvoice'
                        defaultMessage='View Invoice'
                    />
                </button>
            </div>
            <BlockableLink
                to='/admin_console/billing/billing_history'
                className='BillingSummary__lastInvoice-billingHistory'
            >
                <FormattedMessage
                    id='admin.billing.subscriptions.billing_summary.lastInvoice.seeBillingHistory'
                    defaultMessage='See Billing History'
                />
            </BlockableLink>
        </div>
    );
};
