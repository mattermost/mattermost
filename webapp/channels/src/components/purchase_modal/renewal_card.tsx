// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, FormattedNumber, FormattedDate, defineMessages} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Invoice, InvoiceLineItem, Product} from '@mattermost/types/cloud';

import {Client4} from 'mattermost-redux/client';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';

import {getPaymentStatus} from 'components/admin_console/billing/billing_summary/billing_summary';
import CloudInvoicePreview from 'components/cloud_invoice_preview';
import type {Seats} from 'components/seats_calculator';
import SeatsCalculator from 'components/seats_calculator';
import EllipsisHorizontalIcon from 'components/widgets/icons/ellipsis_h_icon';
import WithTooltip from 'components/with_tooltip';

import {BillingSchemes, ModalIdentifiers, TELEMETRY_CATEGORIES, CloudLinks} from 'utils/constants';

import './renewal_card.scss';

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

type RenewalCardProps = {
    invoice: Invoice;
    product?: Product;
    hasMore?: number;
    fullCharges: InvoiceLineItem[];
    partialCharges: InvoiceLineItem[];
    seats: Seats;
    existingUsers: number;
    onSeatChange: (seats: Seats) => void;
    buttonDisabled?: boolean;
    onButtonClick?: () => void;
};

export default function RenewalCard({invoice, product, hasMore, fullCharges, partialCharges, seats, onSeatChange, existingUsers, buttonDisabled, onButtonClick}: RenewalCardProps) {
    const dispatch = useDispatch();

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

    const seeHowBillingWorks = (
        e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
    ) => {
        e.preventDefault();
        trackEvent(
            TELEMETRY_CATEGORIES.CLOUD_ADMIN,
            'click_see_how_billing_works',
        );
        window.open(CloudLinks.DELINQUENCY_DOCS, '_blank');
    };

    return (
        <div className='RenewalRHS'>
            <div className='RenewalCard'>
                <div className='RenewalSummary__lastInvoice-header'>
                    <div className='RenewalSummary__lastInvoice-headerTitle'>
                        <FormattedMessage
                            id='admin.billing.subscription.invoice.next'
                            defaultMessage='Next Invoice'
                        />
                    </div>
                    {getPaymentStatus(invoice.status)}
                </div>
                <div className='RenewalSummary__upcomingInvoice-due-date'>
                    <FormattedMessage
                        id={'cloud.renewal.tobepaid'}
                        defaultMessage={'To be paid on {date}'}
                        values={{
                            date: (
                                <FormattedDate
                                    value={new Date(invoice.period_start)}
                                    month='short'
                                    year='numeric'
                                    day='numeric'
                                    timeZone='UTC'
                                />
                            ),
                        }}
                    />
                </div>
                <div className='RenewalSummary__lastInvoice-productName'>
                    {product?.name}
                </div>
                <hr style={{marginTop: '12px'}}/>
                <SeatsCalculator
                    price={product!.price_per_seat}
                    seats={seats}
                    onChange={(seats: Seats) => {
                        onSeatChange(seats);
                    }}
                    isCloud={true}
                    existingUsers={existingUsers}
                    excludeTotal={true}
                />
                {fullCharges.map((charge: any) => (
                    <div
                        key={charge.price_id}
                        className='RenewalSummary__upcomingInvoice-charge'
                    >
                        <div className='RenewalSummary__upcomingInvoice-chargeDescription'>
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
                                {(' ')}
                                {'('}
                                <FormattedDate
                                    value={new Date(charge.period_start * 1000)}
                                    month='numeric'
                                    year='numeric'
                                    day='numeric'
                                    timeZone='UTC'
                                />
                                {')'}

                            </>
                        </div>
                        <div className='RenewalSummary__lastInvoice-chargeAmount'>
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
                        className='RenewalSummary__upcomingInvoice-hasMoreItems'
                    >
                        <div
                            onClick={openInvoicePreview}
                            className='RenewalSummary__upcomingInvoice-chargeDescription'
                        >
                            {product?.billing_scheme === BillingSchemes.FLAT_FEE ? (
                                <FormattedMessage
                                    id='admin.billing.subscriptions.billing_summary.lastInvoice.monthlyFlatFee'
                                    defaultMessage='Monthly Flat Fee'
                                />
                            ) : (
                                <>
                                    <FormattedMessage
                                        id='cloud.renewal.andMoreItems'
                                        defaultMessage='+ {count} more items'
                                        values={{count: hasMore}}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                )}
                {Boolean(partialCharges.length) && (
                    <>
                        <div className='RenewalSummary__lastInvoice-partialCharges'>
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
                                className='RenewalSummary__lastInvoice-charge'
                            >
                                <div className='RenewalSummary__lastInvoice-chargeDescription'>
                                    <FormattedMessage
                                        id='admin.billing.subscriptions.billing_summary.lastInvoice.seatCountPartial'
                                        defaultMessage='{seats} seats'
                                        values={{seats: charge.quantity}}
                                    />
                                </div>
                                <div className='RenewalSummary__lastInvoice-chargeAmount'>
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
                {Boolean(hasMore) && (
                    <div className='RenewalSummary__upcomingInvoice-ellipses'>
                        <EllipsisHorizontalIcon width={'40px'}/>
                    </div>
                )}
                {Boolean(invoice.tax) && (
                    <div className='RenewalSummary__lastInvoice-charge'>
                        <div className='RenewalSummary__lastInvoice-chargeDescription'>
                            <FormattedMessage
                                id='admin.billing.subscriptions.billing_summary.lastInvoice.taxes'
                                defaultMessage='Taxes'
                            />
                        </div>
                        <div className='RenewalSummary__lastInvoice-chargeAmount'>
                            <FormattedNumber
                                value={invoice.tax / 100.0}
                                // eslint-disable-next-line react/style-prop-object
                                style='currency'
                                currency='USD'
                            />
                        </div>
                    </div>
                )}
                <button
                    onClick={openInvoicePreview}
                    className='RenewalSummary__upcomingInvoice-viewInvoiceLink'
                >
                    <FormattedMessage
                        id='cloud.renewal.viewInvoice'
                        defaultMessage='View Invoice'
                    />
                </button>
                <hr style={{marginTop: '0'}}/>
                <div className='RenewalSummary__upcomingInvoice-charge total'>
                    <div className='RenewalSummary__upcomingInvoice-chargeDescription'>
                        <FormattedMessage
                            id='admin.billing.subscriptions.billing_summary.lastInvoice.total'
                            defaultMessage='Total'
                        />
                    </div>
                    <div className='RenewalSummary__lastInvoice-chargeAmount'>
                        <FormattedNumber
                            value={fullCharges.reduce((sum: number, item) => sum + item.total, 0) / 100.0}
                            // eslint-disable-next-line react/style-prop-object
                            style='currency'
                            currency='USD'
                        />
                    </div>
                </div>

                <button
                    onClick={onButtonClick}
                    className='RenewalSummary__upcomingInvoice-renew-button'
                    disabled={Boolean(buttonDisabled) || Boolean(seats.error)}
                >
                    <FormattedMessage
                        id='cloud.renewal.renew'
                        defaultMessage='Renew'
                    />
                </button>
                <div className='RenewalSummary__disclaimer'>
                    <FormattedMessage
                        defaultMessage={
                            'Your bill is calculated at the end of the billing cycle based on the number of enabled users. {seeHowBillingWorks}'
                        }
                        id={
                            'cloud_delinquency.cc_modal.disclaimer_with_upgrade_info'
                        }
                        values={{
                            seeHowBillingWorks: (
                                <a onClick={seeHowBillingWorks}>
                                    <FormattedMessage
                                        defaultMessage={'See how billing works.'}
                                        id={
                                            'admin.billing.subscription.howItWorks'
                                        }
                                    />
                                </a>
                            ),
                        }}
                    />
                </div>

            </div>
        </div>
    );
}
