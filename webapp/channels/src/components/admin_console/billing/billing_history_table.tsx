// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Invoice} from '@mattermost/types/cloud';
import React, {useState, useEffect} from 'react';
import {FormattedDate, FormattedMessage, FormattedNumber} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';
import {Client4} from 'mattermost-redux/client';
import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';

import CloudInvoicePreview from 'components/cloud_invoice_preview';

import {ModalIdentifiers} from 'utils/constants';

import InvoiceUserCount from './invoice_user_count';

type BillingHistoryTableProps = {
    invoices: Record<string, Invoice>;
};

const PAGE_LENGTH = 4;

const getPaymentStatus = (status: string) => {
    switch (status) {
    case 'failed':
        return (
            <div className='BillingHistory__paymentStatus failed'>
                <i className='icon icon-alert-outline'/>
                <FormattedMessage
                    id='admin.billing.history.paymentFailed'
                    defaultMessage='Payment failed'
                />
            </div>
        );
    case 'paid':
        return (
            <div className='BillingHistory__paymentStatus paid'>
                <i className='icon icon-check-circle-outline'/>
                <FormattedMessage
                    id='admin.billing.history.paid'
                    defaultMessage='Paid'
                />
            </div>
        );
    default:
        return (
            <div className='BillingHistory__paymentStatus pending'>
                <i className='icon icon-check-circle-outline'/>
                <FormattedMessage
                    id='admin.billing.history.pending'
                    defaultMessage='Pending'
                />
            </div>
        );
    }
};

export default function BillingHistoryTable({invoices}: BillingHistoryTableProps) {
    const dispatch = useDispatch();
    const isCloud = useSelector(isCurrentLicenseCloud);

    const [billingHistory, setBillingHistory] = useState<Invoice[] | undefined>(
        undefined,
    );
    const [firstRecord, setFirstRecord] = useState(1);
    const numInvoices = Object.values(invoices || []).length;
    const previousPage = () => {
        if (firstRecord > PAGE_LENGTH) {
            setFirstRecord(firstRecord - PAGE_LENGTH);
        }
    };
    const nextPage = () => {
        if (
            invoices &&
            firstRecord + PAGE_LENGTH < numInvoices
        ) {
            setFirstRecord(firstRecord + PAGE_LENGTH);
        }

        // TODO: When server paging, check if there are more invoices
    };

    useEffect(() => {
        if (invoices && numInvoices) {
            const invoicesByDate = Object.values(invoices).sort(
                (a, b) => b.period_start - a.period_start,
            );
            setBillingHistory(
                invoicesByDate.slice(
                    firstRecord - 1,
                    (firstRecord - 1) + PAGE_LENGTH,
                ),
            );
        }
    }, [invoices, firstRecord]);

    const paging = (
        <div className='BillingHistory__paging'>
            <FormattedMessage
                id='admin.billing.history.pageInfo'
                defaultMessage='{startRecord} - {endRecord} of {totalRecords}'
                values={{
                    startRecord: firstRecord,
                    endRecord: Math.min(
                        firstRecord + (PAGE_LENGTH - 1),
                        Object.values(invoices || []).length,
                    ),
                    totalRecords: Object.values(invoices || []).length,
                }}
            />
            <button
                onClick={previousPage}
                disabled={firstRecord <= PAGE_LENGTH}
            >
                <i className='icon icon-chevron-left'/>
            </button>
            <button
                onClick={nextPage}
                disabled={
                    !invoices ||
                    firstRecord + PAGE_LENGTH >= numInvoices
                }
            >
                <i className='icon icon-chevron-right'/>
            </button>
        </div>
    );
    return (
        <>
            <table className='BillingHistory__table'>
                <tbody>
                    <tr className='BillingHistory__table-header'>
                        <th>
                            <FormattedMessage
                                id='admin.billing.history.date'
                                defaultMessage='Date'
                            />
                        </th>
                        <th>
                            <FormattedMessage
                                id='admin.billing.history.description'
                                defaultMessage='Description'
                            />
                        </th>
                        <th className='BillingHistory__table-headerTotal'>
                            <FormattedMessage
                                id='admin.billing.history.total'
                                defaultMessage='Total'
                            />
                        </th>
                        <th>
                            <FormattedMessage
                                id='admin.billing.history.status'
                                defaultMessage='Status'
                            />
                        </th>
                        <th>{''}</th>
                    </tr>
                    {billingHistory?.map((invoice: Invoice) => {
                        const url = isCloud ? Client4.getInvoicePdfUrl(invoice.id) : Client4.getSelfHostedInvoicePdfUrl(invoice.id);
                        return (
                            <tr
                                className='BillingHistory__table-row'
                                key={invoice.id}
                                onClick={() => {
                                    dispatch(
                                        openModal({
                                            modalId:
                                                ModalIdentifiers.CLOUD_INVOICE_PREVIEW,
                                            dialogType: CloudInvoicePreview,
                                            dialogProps: {
                                                url,
                                            },
                                        }),
                                    );
                                }}
                            >
                                <td data-testid='billingHistoryTableRow'>
                                    <FormattedDate
                                        value={new Date(invoice.period_start)}
                                        month='2-digit'
                                        day='2-digit'
                                        year='numeric'
                                        timeZone='UTC'
                                    />
                                </td>
                                <td>
                                    <div>{invoice.current_product_name}</div>
                                    <div className='BillingHistory__table-bottomDesc'>
                                        <InvoiceUserCount invoice={invoice}/>
                                    </div>
                                </td>
                                <td
                                    data-testid={invoice.number}
                                    className='BillingHistory__table-total'
                                >
                                    <FormattedNumber
                                        value={invoice.total / 100.0}
                                        // eslint-disable-next-line react/style-prop-object
                                        style='currency'
                                        currency='USD'
                                    />
                                </td>
                                <td data-testid={invoice.id}>{getPaymentStatus(invoice.status)}</td>
                                <td className='BillingHistory__table-invoice'>
                                    <a
                                        data-testid={`billingHistoryLink-${invoice.id}`}
                                        target='_self'
                                        rel='noopener noreferrer'
                                        onClick={(e) => e.stopPropagation()}
                                        href={url}
                                    >
                                        <i className='icon icon-file-pdf-outline'/>
                                    </a>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {numInvoices > PAGE_LENGTH && paging}
        </>
    );
}
