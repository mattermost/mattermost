// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedDate, FormattedMessage, FormattedNumber, defineMessages} from 'react-intl';
import {useDispatch} from 'react-redux';

import {CheckCircleOutlineIcon, CheckIcon, ClockOutlineIcon} from '@mattermost/compass-icons/components';
import type {Invoice, InvoiceLineItem, Product} from '@mattermost/types/cloud';

import {Client4} from 'mattermost-redux/client';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';

import BlockableLink from 'components/admin_console/blockable_link';
import CloudInvoicePreview from 'components/cloud_invoice_preview';
import EmptyBillingHistorySvg from 'components/common/svg_images_components/empty_billing_history_svg';
import UpgradeSvg from 'components/common/svg_images_components/upgrade_svg';
import ExternalLink from 'components/external_link';
import WithTooltip from 'components/with_tooltip';

import {BillingSchemes, CloudLinks, TrialPeriodDays, ModalIdentifiers} from 'utils/constants';

const messages = defineMessages({
    partialChargesTooltipTitle: {
        id: 'admin.billing.subscriptions.billing_summary.lastInvoice.whatArePartialCharges',
        defaultMessage: 'What are partial charges?',
    },
    partialChargesTooltipText: {
        id: 'admin.billing.subscriptions.billing_summary.lastInvoice.whatArePartialCharges.message',
        defaultMessage: 'Users who have not been enabled for the full duration of the month are charged at a prorated monthly rate.',
    },
});

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

export const freeTrial = (onUpgradeMattermostCloud: (callerInfo: string) => void, daysLeftOnTrial: number, reverseTrial: boolean) => (
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
            {
                reverseTrial ? (
                    <FormattedMessage
                        id='admin.billing.subscription.cloudTrial.purchaseButton'
                        defaultMessage='Purchase Now'
                    />

                ) : (
                    <FormattedMessage
                        id='admin.billing.subscription.cloudTrial.subscribeButton'
                        defaultMessage='Upgrade Now'
                    />
                )

            }
        </button>
    </div>
);

export const getPaymentStatus = (status: string, willRenew?: boolean) => {
    if (willRenew) {
        return (
            <div className='BillingSummary__lastInvoice-headerStatus paid'>
                <CheckIcon/> {' '}
                <FormattedMessage
                    id='admin.billing.subscriptions.billing_summary.lastInvoice.approved'
                    defaultMessage='Approved'
                />
            </div>
        );
    }
    switch (status.toLowerCase()) {
    case 'failed':
        return (
            <div className='BillingSummary__lastInvoice-headerStatus failed'>
                <i className='icon icon-alert-outline'/> {' '}
                <FormattedMessage
                    id='admin.billing.subscriptions.billing_summary.lastInvoice.failed'
                    defaultMessage='Failed'
                />
            </div>
        );
    case 'paid':
        return (
            <div className='BillingSummary__lastInvoice-headerStatus paid'>
                <CheckCircleOutlineIcon/> {' '}
                <FormattedMessage
                    id='admin.billing.subscriptions.billing_summary.lastInvoice.paid'
                    defaultMessage='Paid'
                />
            </div>
        );
    default:
        return (
            <div className='BillingSummary__lastInvoice-headerStatus pending'>
                <ClockOutlineIcon/> {' '}
                <FormattedMessage
                    id='admin.billing.subscriptions.billing_summary.lastInvoice.pending'
                    defaultMessage='Pending'
                />
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
    willRenew?: boolean;
}

export const InvoiceInfo = ({invoice, product, fullCharges, partialCharges, hasMore, willRenew}: InvoiceInfoProps) => {
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
                {getPaymentStatus(invoice.status, willRenew)}
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
                                    id='admin.billing.subscriptions.billing_summary.lastInvoice.seatCount'
                                    defaultMessage=' x {seats} seats'
                                    values={{seats: charge.quantity}}
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
                        <WithTooltip
                            id='BillingSubscriptions__seatOverageTooltip'
                            title={messages.partialChargesTooltipTitle}
                            hint={messages.partialChargesTooltipText}
                            placement='bottom'
                        >
                            <i className='icon-information-outline'/>
                        </WithTooltip>
                    </div>
                    {partialCharges.map((charge: any) => (
                        <div
                            key={charge.price_id}
                            className='BillingSummary__lastInvoice-charge'
                        >
                            <div className='BillingSummary__lastInvoice-chargeDescription'>
                                <FormattedMessage
                                    id='admin.billing.subscriptions.billing_summary.lastInvoice.seatCountPartial'
                                    defaultMessage='{seats} seats'
                                    values={{seats: charge.quantity}}
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
