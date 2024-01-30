// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {ReportDuration} from '@mattermost/types/reports';

import {setAdminConsoleUsersManagementTableProperties} from 'actions/views/admin';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';

import './system_users_date_range_menu.scss';

function get30DaysBack(now: Date) {
    const prev = new Date(now);
    prev.setDate(prev.getDate() - 30);
    return prev;
}

function get6MonthsBack(now: Date) {
    const prev = new Date(now);
    prev.setMonth(prev.getMonth() - 6);
    return prev;
}

function getBeginningOfLastMonth(now: Date) {
    const beginningOfMonth = new Date(now);
    beginningOfMonth.setMonth(beginningOfMonth.getMonth() - 1);
    beginningOfMonth.setDate(1);
    return beginningOfMonth;
}

function getEndOfLastMonth(now: Date) {
    const endOfMonth = new Date(now);
    endOfMonth.setDate(1);
    endOfMonth.setDate(endOfMonth.getDate() - 1);
    return endOfMonth;
}

type Props = {
    dateRange: ReportDuration;
}

export function SystemUsersDateRangeMenu(props: Props) {
    const {formatMessage, formatDate} = useIntl();

    const dispatch = useDispatch();

    const now = new Date();

    function getSelectedDateRange(dateRange: ReportDuration) {
        if (dateRange === ReportDuration.Last30Days) {
            return formatMessage({
                id: 'admin.system_users.date_range_selector.date_range.last_30_days',
                defaultMessage: 'Last 30 days',
            });
        } else if (dateRange === ReportDuration.PreviousMonth) {
            return formatMessage({
                id: 'admin.system_users.date_range_selector.date_range.previous_month',
                defaultMessage: 'Previous month',
            });
        } else if (dateRange === ReportDuration.Last6Months) {
            return formatMessage({
                id: 'admin.system_users.date_range_selector.date_range.last_6_months',
                defaultMessage: 'Last 6 months',
            });
        }

        return formatMessage({
            id: 'admin.system_users.date_range_selector.date_range.all_time',
            defaultMessage: 'All time',
        });
    }

    function updateDateRange(value?: ReportDuration) {
        dispatch(setAdminConsoleUsersManagementTableProperties({dateRange: value}));
    }

    return (
        <div className='systemUsersDateRangeSelector'>
            <Menu.Container
                menuButton={{
                    id: 'systemUsersDateRangeSelectorMenuButton',
                    class: 'inputWithMenu',
                    'aria-label': formatMessage({
                        id: 'admin.system_users.date_range_selector.menuButtonAriaLabel',
                        defaultMessage:
                            'Open menu to select columns to display',
                    }),
                    as: 'div',
                    children: (
                        <Input
                            label={formatMessage({
                                id: 'admin.system_users.date_range_selector.label',
                                defaultMessage: 'Duration',
                            })}
                            name='colXC'
                            value={getSelectedDateRange(props.dateRange)}
                            readOnly={true}
                            inputSuffix={
                                <i className='icon icon-chevron-down'/>
                            }
                        />
                    ),
                }}
                menu={{
                    id: 'systemUsersDateRangeSelectorMenu',
                    'aria-label': formatMessage({
                        id: 'admin.system_users.date_range_selector.dropdownAriaLabel',
                        defaultMessage: 'Date range menu',
                    }),
                    width: '250px',
                }}
            >
                <Menu.Item
                    key={ReportDuration.AllTime}
                    id={ReportDuration.AllTime}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.date_range_selector.date_range.all_time'
                            defaultMessage='All time'
                        />
                    }
                    trailingElements={props.dateRange === ReportDuration.AllTime && <i className='icon icon-check'/>}
                    onClick={() => updateDateRange()}
                />
                <Menu.Item
                    key={ReportDuration.Last30Days}
                    id={ReportDuration.Last30Days}
                    labels={
                        <>
                            <FormattedMessage
                                id='admin.system_users.date_range_selector.date_range.last_30_days'
                                defaultMessage='Last 30 days'
                            />
                            <FormattedMessage
                                id='admin.system_users.date_range_selector.date_range.sublabel'
                                defaultMessage='{startDate} - {endDate}'
                                values={{
                                    startDate: formatDate(get30DaysBack(now)),
                                    endDate: formatDate(now),
                                }}
                            />
                        </>
                    }
                    trailingElements={props.dateRange === ReportDuration.Last30Days && <i className='icon icon-check'/>}
                    onClick={() => updateDateRange(ReportDuration.Last30Days)}
                />
                <Menu.Item
                    key={ReportDuration.PreviousMonth}
                    id={ReportDuration.PreviousMonth}
                    labels={
                        <>
                            <FormattedMessage
                                id='admin.system_users.date_range_selector.date_range.previous_month'
                                defaultMessage='Previous month'
                            />
                            <FormattedMessage
                                id='admin.system_users.date_range_selector.date_range.sublabel'
                                defaultMessage='{startDate} - {endDate}'
                                values={{
                                    startDate: formatDate(getBeginningOfLastMonth(now)),
                                    endDate: formatDate(getEndOfLastMonth(now)),
                                }}
                            />
                        </>
                    }
                    trailingElements={props.dateRange === ReportDuration.PreviousMonth && <i className='icon icon-check'/>}
                    onClick={() => updateDateRange(ReportDuration.PreviousMonth)}
                />
                <Menu.Item
                    key={ReportDuration.Last6Months}
                    id={ReportDuration.Last6Months}
                    labels={
                        <>
                            <FormattedMessage
                                id='admin.system_users.date_range_selector.date_range.last_6_months'
                                defaultMessage='Last 6 months'
                            />
                            <FormattedMessage
                                id='admin.system_users.date_range_selector.date_range.sublabel'
                                defaultMessage='{startDate} - {endDate}'
                                values={{
                                    startDate: formatDate(get6MonthsBack(now), {month: 'numeric', year: 'numeric'}),
                                    endDate: formatDate(now, {month: 'numeric', year: 'numeric'}),
                                }}
                            />
                        </>

                    }
                    trailingElements={props.dateRange === ReportDuration.Last6Months && <i className='icon icon-check'/>}
                    onClick={() => updateDateRange(ReportDuration.Last6Months)}
                />
                <Menu.Separator/>
                <Menu.Item
                    key='trailing_message'
                    id='trailing_message'
                    className='systemUsersDateRangeSelector__trailing-message'
                    labels={
                        <>
                            <span/>
                            <FormattedMessage
                                id='admin.system_users.date_range_selector.trailing_message'
                                defaultMessage='Note: This filter will only affect values in the <strong>Last Post, Days Active, and Messages Posted</strong> columns.'
                                values={{
                                    strong: (chunks: React.ReactNode) => (<strong>{chunks}</strong>),
                                }}
                            />
                        </>
                    }
                    disabled={true}
                />
            </Menu.Container>
        </div>
    );
}
