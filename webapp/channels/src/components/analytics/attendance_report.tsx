// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import { CellContext, ColumnDef, PaginationState, SortingState, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import * as XLSX from 'xlsx';

import { Client4 } from 'mattermost-redux/client';

import {AdminConsoleListTable, LoadingStates, PAGE_SIZES} from 'components/admin_console/list_table';
import type {TableMeta} from 'components/admin_console/list_table';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import Avatar from 'components/widgets/users/avatar';
import LoadingScreen from 'components/loading_screen';
import { imageURLForUser } from 'utils/utils';

import {AttendanceReportSearch, AttendanceReportDateFilter, AttendanceReportTeamFilter} from './attendance_report_filters';
import CheckInImage from './checkin_image';
import StatisticCount from './statistic_count';
import './attendance_report.scss';

// Types
type AttendanceStats = {
    from: string;
    to: string;
    total_checked_in: number;
    total_working: number;
    total_on_break: number;
    total_checked_out: number;
    total_on_leave: number;
    total_late_arrivals: number;
    total_early_departures: number;
    pending_requests: number;
};

type BreakLog = { reason: string; start: number; end?: number };

type AttendanceEntry = {
    date: string;
    check_in: number;
    checkin_image_id?: string;
    check_out?: number;
    checkout_image_id?: string;
    status: string;
    total_breaks: number;
    break_rest: number;
    break_eat: number;
    break_restroom_s: number;
    break_restroom_l: number;
    break_smoke: number;
    breaks?: BreakLog[];
};

type LeaveEntry = {
    type: string;
    dates: string[];
    reason: string;
    expected_time?: string;
    status: string;
};

type UserReport = {
    id: string; // Required for AdminConsoleListTable
    user_id: string;
    username: string;
    days_worked: number;
    days_leave: number;
    late_arrivals: number;
    early_departures: number;
    break_rest: number;
    break_eat: number;
    break_restroom_s: number;
    break_restroom_l: number;
    break_smoke: number;
    attendance: AttendanceEntry[];
    leave_requests: LeaveEntry[];
};

type AttendanceReport = {
    from: string;
    to: string;
    users: Omit<UserReport, 'id'>[];
};

const messages = defineMessages({
    title: { id: 'analytics.attendance.title', defaultMessage: 'Attendance Report' },
    checkedIn: { id: 'analytics.attendance.checkedIn', defaultMessage: 'Checked In' },
    onLeave: { id: 'analytics.attendance.onLeave', defaultMessage: 'On Leave' },
    lateArrivals: { id: 'analytics.attendance.lateArrivals', defaultMessage: 'Late Arrivals' },
    earlyDepartures: { id: 'analytics.attendance.earlyDepartures', defaultMessage: 'Early Departures' },
    pendingRequests: { id: 'analytics.attendance.pendingRequests', defaultMessage: 'Pending Requests' },
    username: { id: 'analytics.attendance.username', defaultMessage: 'Username' },
    daysWorked: { id: 'analytics.attendance.daysWorked', defaultMessage: 'Days Worked' },
    daysLeave: { id: 'analytics.attendance.daysLeave', defaultMessage: 'Days Leave' },
    noData: { id: 'analytics.attendance.noData', defaultMessage: 'No attendance data found for this date range.' },
    date: { id: 'analytics.attendance.date', defaultMessage: 'Date' },
    checkIn: { id: 'analytics.attendance.checkIn', defaultMessage: 'Check In' },
    checkOut: { id: 'analytics.attendance.checkOut', defaultMessage: 'Check Out' },
    status: { id: 'analytics.attendance.status', defaultMessage: 'Status' },
    type: { id: 'analytics.attendance.type', defaultMessage: 'Type' },
    dates: { id: 'analytics.attendance.dates', defaultMessage: 'Dates' },
    reason: { id: 'analytics.attendance.reason', defaultMessage: 'Reason' },
    totalBreaks: { id: 'analytics.attendance.totalBreaks', defaultMessage: 'Total Breaks' },
    breakRest: { id: 'analytics.attendance.breakRest', defaultMessage: 'Rest' },
    breakEat: { id: 'analytics.attendance.breakEat', defaultMessage: 'Lunch' },
    breakRestroomS: { id: 'analytics.attendance.breakRestroomS', defaultMessage: 'Restroom (short)' },
    breakRestroomL: { id: 'analytics.attendance.breakRestroomL', defaultMessage: 'Restroom (long)' },
    breakSmoke: { id: 'analytics.attendance.breakSmoke', defaultMessage: 'Smoking' },
    totalBreaksCol: {id: 'analytics.attendance.totalBreaksCol', defaultMessage: 'Breaks'},
    breakRestCol: {id: 'analytics.attendance.breakRestCol', defaultMessage: 'Rest'},
    breakEatCol: {id: 'analytics.attendance.breakEatCol', defaultMessage: 'Lunch'},
    breakRestroomSCol: {id: 'analytics.attendance.breakRestroomSCol', defaultMessage: 'Restroom (S)'},
    breakRestroomLCol: {id: 'analytics.attendance.breakRestroomLCol', defaultMessage: 'Restroom (L)'},
    breakSmokeCol: {id: 'analytics.attendance.breakSmokeCol', defaultMessage: 'Smoking'},
    breaks: {id: 'analytics.attendance.breaks', defaultMessage: 'Breaks'},
    onBreak: {id: 'analytics.attendance.onBreak', defaultMessage: 'on break'},
    back: { id: 'analytics.attendance.back', defaultMessage: 'Back to all users' },
    attendanceDetail: { id: 'analytics.attendance.attendanceDetail', defaultMessage: 'Attendance' },
    leaveDetail: { id: 'analytics.attendance.leaveDetail', defaultMessage: 'Leave Requests' },
    userDetail: { id: 'analytics.attendance.userDetail', defaultMessage: 'Detail for {username}' },
    from: { id: 'analytics.attendance.from', defaultMessage: 'From' },
    to: { id: 'analytics.attendance.to', defaultMessage: 'To' },
    searchPlaceholder: { id: 'analytics.attendance.searchPlaceholder', defaultMessage: 'Search by username...' },
    breakLogReason: { id: 'analytics.attendance.breakLogReason', defaultMessage: 'Reason' },
    breakLogStart: { id: 'analytics.attendance.breakLogStart', defaultMessage: 'Start' },
    breakLogEnd: { id: 'analytics.attendance.breakLogEnd', defaultMessage: 'End' },
    sheetSummary: { id: 'analytics.attendance.sheetSummary', defaultMessage: 'Summary' },
    sheetDetail: { id: 'analytics.attendance.sheetDetail', defaultMessage: 'Detail' },
});

function formatBreakDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
        return `${h}g ${m}p ${s}s`;
    }
    if (m > 0) {
        return `${m}p ${s}s`;
    }
    return `${s}s`;
}


function apiFetch(url: string): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = Client4.getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return fetch(url, { headers, credentials: 'include' });
}

const statusBadge = (status: string) => {
    let color = '#999';
    if (status === 'approved' || status === 'completed') {
        color = '#339970';
    } else if (status === 'pending' || status === 'working') {
        color = '#f5a623';
    } else if (status === 'rejected') {
        color = '#d24b4e';
    } else if (status === 'break') {
        color = '#1e88e5';
    }
    return (
        <span
            style={{
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: color,
                color: '#fff',
                fontSize: '12px',
            }}
        >
            {status}
        </span>
    );
};

// User detail panel
type UserDetailPanelProps = {
    user: UserReport;
    filterMode: 'month' | 'date';
    selectedMonth: string;
    selectedDay: number;
}

const BREAK_REASON_META: Record<string, { icon: string; msgKey: keyof typeof messages }> = {
    nghi_ngoi: {icon: 'fa-coffee', msgKey: 'breakRest'},
    di_an: {icon: 'fa-cutlery', msgKey: 'breakEat'},
    tieu_tien: {icon: 'fa-tint', msgKey: 'breakRestroomS'},
    dai_tien: {icon: 'fa-tint', msgKey: 'breakRestroomL'},
    hut_thuoc: {icon: 'fa-fire', msgKey: 'breakSmoke'},
};

function fmtTime(unix: number): string {
    return new Date(unix * 1000).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
}

function calcBreakDuration(start: number, end: number): number {
    return end - start;
}

type FormatMessage = (msg: {id: string; defaultMessage: string}) => string;

function autoColWidths(rows: Array<Array<string | number>>): Array<{wch: number}> {
    if (rows.length === 0) {
        return [];
    }
    const numCols = rows[0].length;
    const widths = new Array(numCols).fill(8);
    for (const row of rows) {
        for (let c = 0; c < row.length; c++) {
            const val = row[c] == null ? '' : String(row[c]);

            // Vietnamese/unicode chars count as ~1.6 chars width
            const len = [...val].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 127 ? 1.6 : 1), 0);
            if (len > widths[c]) {
                widths[c] = len;
            }
        }
    }
    return widths.map((w) => ({wch: Math.min(Math.ceil(w) + 2, 50)}));
}

function exportToExcel(users: UserReport[], from: string, to: string, fmt: FormatMessage) {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Tổng hợp
    const sheet1Rows = [
        [
            fmt(messages.username), fmt(messages.daysWorked), fmt(messages.daysLeave),
            fmt(messages.lateArrivals), fmt(messages.earlyDepartures),
            fmt(messages.breakRestCol), fmt(messages.breakEatCol),
            fmt(messages.breakRestroomSCol), fmt(messages.breakRestroomLCol), fmt(messages.breakSmokeCol),
        ],
        ...users.map((u) => [
            u.username, u.days_worked, u.days_leave,
            u.late_arrivals, u.early_departures,
            u.break_rest, u.break_eat, u.break_restroom_s, u.break_restroom_l, u.break_smoke,
        ]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
    ws1['!cols'] = autoColWidths(sheet1Rows);
    XLSX.utils.book_append_sheet(wb, ws1, fmt(messages.sheetSummary));

    // Sheet 2: Chi tiết — 1 row/break log; ngày không có break thì 1 row trống ở cột break
    const detailRows: Array<Array<string>> = [];
    for (const u of users) {
        for (const e of (u.attendance ?? [])) {
            const checkIn = e.check_in ? fmtTime(e.check_in) : '';
            const checkOut = e.check_out ? fmtTime(e.check_out) : '';
            const base = [u.username, e.date, checkIn, checkOut, e.status];
            if (!e.breaks || e.breaks.length === 0) {
                detailRows.push([...base, '', '', '', '']);
            } else {
                for (const b of e.breaks) {
                    const meta = BREAK_REASON_META[b.reason];
                    const reasonLabel = meta ? fmt(messages[meta.msgKey]) : b.reason;
                    const duration = b.end ? formatBreakDuration(calcBreakDuration(b.start, b.end)) : '';
                    detailRows.push([...base, reasonLabel, fmtTime(b.start), b.end ? fmtTime(b.end) : '', duration]);
                }
            }
        }
    }
    const sheet2Header = [
        fmt(messages.username), fmt(messages.date),
        fmt(messages.checkIn), fmt(messages.checkOut), fmt(messages.status),
        fmt(messages.breakLogReason), fmt(messages.breakLogStart), fmt(messages.breakLogEnd),
        fmt(messages.totalBreaks),
    ];
    const sheet2Rows = [sheet2Header, ...detailRows];
    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
    ws2['!cols'] = autoColWidths(sheet2Rows);
    XLSX.utils.book_append_sheet(wb, ws2, fmt(messages.sheetDetail));

    XLSX.writeFile(wb, `attendance_${from}_${to}.xlsx`);
}

const BreakLogList: React.FC<{ entry: AttendanceEntry }> = ({entry}) => {
    const {formatMessage} = useIntl();
    const logs = entry.breaks ?? [];
    if (logs.length === 0) {
        return null;
    }
    return (
        <div className='attendance-day-card__breaks'>
            <div className='attendance-day-card__label' style={{marginBottom: '6px'}}>
                <FormattedMessage {...messages.breaks}/>
            </div>
            <table
                style={{fontSize: '12px', borderCollapse: 'collapse', width: '100%'}}
            >
                <thead>
                    <tr>
                        <th style={{fontWeight: 600, paddingRight: '12px', textAlign: 'left'}}><FormattedMessage {...messages.breakLogStart}/></th>
                        <th style={{fontWeight: 600, paddingRight: '12px', textAlign: 'left'}}><FormattedMessage {...messages.breakLogEnd}/></th>
                        <th style={{fontWeight: 600, paddingRight: '12px', textAlign: 'left'}}><FormattedMessage {...messages.breakLogReason}/></th>
                        <th style={{fontWeight: 600, textAlign: 'left'}}><FormattedMessage {...messages.totalBreaks}/></th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((b) => {
                        const meta = BREAK_REASON_META[b.reason];
                        const label = meta ? formatMessage(messages[meta.msgKey]) : b.reason;
                        const icon = meta ? meta.icon : 'fa-clock-o';
                        const duration = b.end ? formatBreakDuration(calcBreakDuration(b.start, b.end)) : null;
                        return (
                            <tr key={b.start}>
                                <td style={{paddingRight: '12px'}}>{fmtTime(b.start)}</td>
                                <td style={{paddingRight: '12px'}}>
                                    {b.end ? fmtTime(b.end) : <em><FormattedMessage {...messages.onBreak}/></em>}
                                </td>
                                <td style={{paddingRight: '12px'}}>
                                    <i className={`fa ${icon}`}/>{' '}{label}
                                </td>
                                <td>{duration === null ? '-' : duration}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const UserDetailPanel: React.FC<UserDetailPanelProps> = ({user, filterMode, selectedMonth, selectedDay}) => {
    // Build full day list for month mode
    const allDays = useMemo(() => {
        if (filterMode !== 'month') {
            return [];
        }
        const [yearStr, mStr] = selectedMonth.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(mStr, 10);
        const lastDay = new Date(year, month, 0).getDate();
        const map: Record<string, AttendanceEntry> = {};
        for (const entry of (user.attendance || [])) {
            map[entry.date] = entry;
        }
        const days: Array<{ date: string; entry: AttendanceEntry | null }> = [];
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
            days.push({date: dateStr, entry: map[dateStr] ?? null});
        }
        return days;
    }, [filterMode, selectedMonth, user.attendance]);

    // Single day entry for date mode
    const singleEntry = useMemo(() => {
        if (filterMode !== 'date') {
            return null;
        }
        const dayStr = String(selectedDay).padStart(2, '0');
        const dateStr = `${selectedMonth}-${dayStr}`;
        return (user.attendance || []).find((e) => e.date === dateStr) ?? null;
    }, [filterMode, selectedMonth, selectedDay, user.attendance]);

    return (
        <div>
            {/* Summary */}
            <div className='grid-statistics'>
                <StatisticCount
                    title={<FormattedMessage {...messages.daysWorked} />}
                    icon='fa-briefcase'
                    count={user.days_worked}
                />
                <StatisticCount
                    title={<FormattedMessage {...messages.daysLeave} />}
                    icon='fa-calendar-times-o'
                    count={user.days_leave}
                />
                <StatisticCount
                    title={<FormattedMessage {...messages.lateArrivals} />}
                    icon='fa-clock-o'
                    count={user.late_arrivals}
                    status={user.late_arrivals > 0 ? 'warning' : undefined}
                />
                <StatisticCount
                    title={<FormattedMessage {...messages.earlyDepartures} />}
                    icon='fa-sign-out'
                    count={user.early_departures}
                />
            </div>

            {filterMode === 'date' ? (
                /* Date mode: single-day card */
                <div style={{marginTop: '20px'}}>
                    {singleEntry ? (
                        <div className='attendance-day-card'>
                            <div className='attendance-day-card__row'>
                                <span className='attendance-day-card__label'><FormattedMessage {...messages.checkIn} /></span>
                                <span className='attendance-day-card__value'>{fmtTime(singleEntry.check_in)}</span>
                            </div>
                            {singleEntry.checkin_image_id && <CheckInImage fileId={singleEntry.checkin_image_id}/>}
                            <div className='attendance-day-card__row'>
                                <span className='attendance-day-card__label'><FormattedMessage {...messages.checkOut} /></span>
                                <span className='attendance-day-card__value'>{singleEntry.check_out ? fmtTime(singleEntry.check_out) : '—'}</span>
                            </div>
                            {singleEntry.checkout_image_id && <CheckInImage fileId={singleEntry.checkout_image_id}/>}
                            <div className='attendance-day-card__row'>
                                <span className='attendance-day-card__label'><FormattedMessage {...messages.status} /></span>
                                <span className='attendance-day-card__value'>{statusBadge(singleEntry.status)}</span>
                            </div>
                            <BreakLogList entry={singleEntry}/>
                        </div>
                    ) : (
                        <div className='attendance-day-card attendance-day-card--empty'>
                            <i className='fa fa-calendar-o' style={{fontSize: '24px', opacity: 0.4}}/>
                            <p style={{marginTop: '8px', opacity: 0.5}}>
                                <FormattedMessage {...messages.noData} />
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                /* Month mode: cards for each day */
                <div style={{marginTop: '20px'}}>
                    <h5><FormattedMessage {...messages.attendanceDetail} /></h5>
                    <div className='attendance-month-day-cards'>
                        {allDays.map(({date, entry}) => (
                            entry ? (
                                <div
                                    key={date}
                                    className='attendance-day-card'
                                >
                                    <div className='attendance-day-card__date'>{date}</div>
                                    <div className='attendance-day-card__row'>
                                        <span className='attendance-day-card__label'><FormattedMessage {...messages.checkIn} /></span>
                                        <span className='attendance-day-card__value'>{fmtTime(entry.check_in)}</span>
                                    </div>
                                    {entry.checkin_image_id && (
                                        <CheckInImage
                                            fileId={entry.checkin_image_id}
                                            size={80}
                                        />
                                    )}
                                    <div className='attendance-day-card__row'>
                                        <span className='attendance-day-card__label'><FormattedMessage {...messages.checkOut} /></span>
                                        <span className='attendance-day-card__value'>{entry.check_out ? fmtTime(entry.check_out) : '—'}</span>
                                    </div>
                                    {entry.checkout_image_id && (
                                        <CheckInImage
                                            fileId={entry.checkout_image_id}
                                            size={80}
                                        />
                                    )}
                                    <div className='attendance-day-card__row'>
                                        <span className='attendance-day-card__label'><FormattedMessage {...messages.status} /></span>
                                        <span className='attendance-day-card__value'>{statusBadge(entry.status)}</span>
                                    </div>
                                    <BreakLogList entry={entry}/>
                                </div>
                            ) : (
                                <div
                                    key={date}
                                    className='attendance-day-card attendance-day-card--empty'
                                >
                                    <div className='attendance-day-card__date'>{date}</div>
                                    <span style={{opacity: 0.35, fontSize: '12px'}}>{'—'}</span>
                                </div>
                            )
                        ))}
                    </div>
                </div>
            )}

            {/* Leave requests - only in month mode */}
            {filterMode === 'month' && user.leave_requests && user.leave_requests.length > 0 && (
                <div style={{marginTop: '20px'}}>
                    <h5><FormattedMessage {...messages.leaveDetail} /></h5>
                    <div className='total-count recent-active-users'>
                        <table className='table'>
                            <thead>
                                <tr>
                                    <th><FormattedMessage {...messages.type} /></th>
                                    <th><FormattedMessage {...messages.dates} /></th>
                                    <th><FormattedMessage {...messages.reason} /></th>
                                    <th><FormattedMessage {...messages.status} /></th>
                                </tr>
                            </thead>
                            <tbody>
                                {user.leave_requests.map((req, idx) => (
                                    <tr key={idx}>
                                        <td>{req.type}</td>
                                        <td>{req.dates.join(', ')}</td>
                                        <td>{req.reason}</td>
                                        <td>{statusBadge(req.status)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

const AttendanceReportPage: React.FC = () => {
    const { formatMessage } = useIntl();
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return now.toISOString().slice(0, 7); // YYYY-MM
    });
    const [filterMode, setFilterMode] = useState<'month' | 'date'>('month');
    const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());

    const [stats, setStats] = useState<AttendanceStats | null>(null);
    const [report, setReport] = useState<AttendanceReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserReport | null>(null);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTeam, setFilterTeam] = useState('');
    const [filterTeamLabel, setFilterTeamLabel] = useState('');

    // Table states
    const [sorting, setSorting] = useState<SortingState>([]);
    const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZES[0] });

    const dateRange = useMemo(() => {
        if (filterMode === 'month') {
            const [yearStr, monthStr] = selectedMonth.split('-');
            const lastDay = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0).getDate();
            return {from: `${selectedMonth}-01`, to: `${selectedMonth}-${String(lastDay).padStart(2, '0')}`};
        }
        const day = `${selectedMonth}-${String(selectedDay).padStart(2, '0')}`;
        return {from: day, to: day};
    }, [selectedMonth, filterMode, selectedDay]);

    const filteredUsers: UserReport[] = useMemo(() => {
        if (!report?.users) {
            return [];
        }
        let users = report.users.map(u => ({ ...u, id: u.user_id }));

        if (searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase();
            users = users.filter((u) => u.username.toLowerCase().includes(term));
        }

        return users;
    }, [report, searchTerm]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        setSelectedUser(null);

        let from: string;
        let to: string;

        if (filterMode === 'month') {
            // Calculate from/to based on selectedMonth (full month)
            const [yearStr, monthStr] = selectedMonth.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            from = `${selectedMonth}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            to = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
        } else {
            // Single day within the selected month
            const dayStr = String(selectedDay).padStart(2, '0');
            from = `${selectedMonth}-${dayStr}`;
            to = from;
        }

        const base = Client4.getBaseRoute();
        let query = `from=${from}&to=${to}`;

        if (filterTeam && filterTeam !== 'teams_filter_for_all_teams') {
            query += `&team_id=${filterTeam}`;
        }

        try {
            const [statsRes, reportRes] = await Promise.all([
                apiFetch(`${base}/bot-service/attendance/stats?${query}`),
                apiFetch(`${base}/bot-service/attendance/report?${query}`),
            ]);

            if (!statsRes.ok) {
                throw new Error(`Stats API error: ${statsRes.status}`);
            }
            if (!reportRes.ok) {
                throw new Error(`Report API error: ${reportRes.status}`);
            }

            const [statsData, reportData] = await Promise.all([
                statsRes.json() as Promise<AttendanceStats>,
                reportRes.json() as Promise<AttendanceReport>,
            ]);

            setStats(statsData);
            setReport(reportData);
        } catch (err: any) {
            setError(err.message || 'Failed to load attendance data');
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, filterTeam, filterMode, selectedDay]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Define columns
    const columns = useMemo<ColumnDef<UserReport, any>[]>(() => [
        {
            id: 'username',
            accessorKey: 'username',
            header: formatMessage(messages.username),
            cell: (info: CellContext<UserReport, unknown>) => (
                <div className='TeamList_nameColumn'>
                    <div className='TeamList__lowerOpacity' style={{ marginRight: '12px' }}>
                        <Avatar
                            size='sm'
                            url={imageURLForUser(info.row.original.user_id)}
                            username={info.getValue() as string}
                        />
                    </div>
                    <div className='TeamList_nameText'>
                        <span
                            onClick={() => setSelectedUser(info.row.original)}
                            style={{ cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {info.getValue() as string}
                        </span>
                    </div>
                </div>
            ),
        },
        {
            id: 'days_worked',
            accessorKey: 'days_worked',
            header: formatMessage(messages.daysWorked),
            cell: (info) => info.getValue(),
            enablePinning: false,
        },
        {
            id: 'days_leave',
            accessorKey: 'days_leave',
            header: formatMessage(messages.daysLeave),
            cell: (info) => info.getValue(),
            enablePinning: false,
        },
        {
            id: 'late_arrivals',
            accessorKey: 'late_arrivals',
            header: formatMessage(messages.lateArrivals),
            cell: (info) => info.getValue(),
            enablePinning: false,
        },
        {
            id: 'early_departures',
            accessorKey: 'early_departures',
            header: formatMessage(messages.earlyDepartures),
            cell: (info) => info.getValue(),
            enablePinning: false,
        },
        {
            id: 'break_rest',
            accessorKey: 'break_rest',
            header: formatMessage(messages.breakRestCol),
            cell: (info) => info.getValue(),
            enablePinning: false,
        },
        {
            id: 'break_eat',
            accessorKey: 'break_eat',
            header: formatMessage(messages.breakEatCol),
            cell: (info) => info.getValue(),
            enablePinning: false,
        },
        {
            id: 'break_restroom_s',
            accessorKey: 'break_restroom_s',
            header: formatMessage(messages.breakRestroomSCol),
            cell: (info) => info.getValue(),
            enablePinning: false,
        },
        {
            id: 'break_restroom_l',
            accessorKey: 'break_restroom_l',
            header: formatMessage(messages.breakRestroomLCol),
            cell: (info) => info.getValue(),
            enablePinning: false,
        },
        {
            id: 'break_smoke',
            accessorKey: 'break_smoke',
            header: formatMessage(messages.breakSmokeCol),
            cell: (info) => info.getValue(),
            enablePinning: false,
        },
    ], [formatMessage]);

    // Table instance
    const table = useReactTable({
        data: filteredUsers,
        columns,
        state: {
            sorting,
            pagination,
        },
        onSortingChange: setSorting,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        meta: {
            tableId: 'attendanceReportTable',
            tableCaption: formatMessage(messages.title),
            loadingState: loading ? LoadingStates.Loading : LoadingStates.Loaded,
            onRowClick: (id) => {
                const user = filteredUsers.find(u => u.id === id);
                if (user) {
                    setSelectedUser(user);
                }
            },
        } as TableMeta,
    });

    if (loading && !report) {
        // Show loading screen initially
        return <LoadingScreen />;
    }

    return (
        <div className='wrapper--fixed team_statistics'>
            <AdminHeader withBackButton={Boolean(selectedUser)}>
                {selectedUser ? (
                    <div>
                        <div
                            onClick={() => setSelectedUser(null)}
                            className='fa fa-angle-left back'
                            style={{ cursor: 'pointer' }}
                        />
                        <FormattedMessage
                            {...messages.userDetail}
                            values={{ username: selectedUser.username }}
                        />
                        <span style={{marginLeft: '8px', opacity: 0.6, fontWeight: 400, fontSize: '14px'}}>
                            {'— '}
                            {filterMode === 'date'
                                ? `${selectedMonth}-${String(selectedDay).padStart(2, '0')}`
                                : `Th.${parseInt(selectedMonth.split('-')[1], 10)} ${selectedMonth.split('-')[0]}`
                            }
                        </span>
                    </div>
                ) : (
                    <FormattedMessage {...messages.title} />
                )}
            </AdminHeader>

            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    {error && (
                        <div className='banner banner--error'>
                            <div className='banner__content'>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {selectedUser ? (
                        <UserDetailPanel
                            user={selectedUser}
                            filterMode={filterMode}
                            selectedMonth={selectedMonth}
                            selectedDay={selectedDay}
                        />
                    ) : (
                        <>
                            {/* Stats cards */}
                            {stats && (
                                <>
                                    <div className='grid-statistics' style={{ marginBottom: '20px' }}>
                                        <StatisticCount
                                            title={<FormattedMessage {...messages.checkedIn} />}
                                            icon='fa-sign-in'
                                            count={stats.total_checked_in}
                                        />
                                        <StatisticCount
                                            title={<FormattedMessage {...messages.onLeave} />}
                                            icon='fa-calendar-times-o'
                                            count={stats.total_on_leave}
                                        />
                                        <StatisticCount
                                            title={<FormattedMessage {...messages.lateArrivals} />}
                                            icon='fa-clock-o'
                                            count={stats.total_late_arrivals}
                                            status={stats.total_late_arrivals > 0 ? 'warning' : undefined}
                                        />
                                        <StatisticCount
                                            title={<FormattedMessage {...messages.earlyDepartures} />}
                                            icon='fa-sign-out'
                                            count={stats.total_early_departures}
                                        />
                                        <StatisticCount
                                            title={<FormattedMessage {...messages.pendingRequests} />}
                                            icon='fa-hourglass-half'
                                            count={stats.pending_requests}
                                            status={stats.pending_requests > 0 ? 'warning' : undefined}
                                        />
                                    </div>
                                </>
                            )}

                            <div className='admin-console__container ignore-marking'>
                                <div className='admin-console__filters-rows'>
                                    <AttendanceReportSearch
                                        term={searchTerm}
                                        onSearch={setSearchTerm}
                                    />
                                    <AttendanceReportDateFilter
                                        month={selectedMonth}
                                        onChange={setSelectedMonth}
                                        selectedDay={selectedDay}
                                        onDayChange={setSelectedDay}
                                        filterMode={filterMode}
                                        onFilterModeChange={setFilterMode}
                                    />
                                    <AttendanceReportTeamFilter
                                        filterTeam={filterTeam}
                                        filterTeamLabel={filterTeamLabel}
                                        onChange={(id, label) => {
                                            setFilterTeam(id);
                                            setFilterTeamLabel(label || '');
                                        }}
                                    />
                                    <button
                                        className='btn btn-default'
                                        disabled={filteredUsers.length === 0}
                                        onClick={() => exportToExcel(filteredUsers, dateRange.from, dateRange.to, formatMessage)}
                                    >
                                        <i className='fa fa-download'/>
                                        {' Export Excel'}
                                    </button>
                                </div>
                                <AdminConsoleListTable
                                    table={table}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceReportPage;
