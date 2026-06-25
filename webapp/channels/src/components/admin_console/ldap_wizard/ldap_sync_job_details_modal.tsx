// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {defineMessage, defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Job} from '@mattermost/types/jobs';

import {getGroup as fetchGroup} from 'mattermost-redux/actions/groups';
import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {getAllGroups} from 'mattermost-redux/selectors/entities/groups';
import {getUsers} from 'mattermost-redux/selectors/entities/users';

import LocalizedPlaceholderInput from 'components/localized_placeholder_input';
import UserGroupPopover from 'components/user_group_popover';
import UserProfile from 'components/user_profile';
import NextIcon from 'components/widgets/icons/fa_next_icon';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';

import {JobStatuses} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './ldap_sync_job_details_modal.scss';

// SyncWarning mirrors the server-side ldap.SyncWarning struct serialized into
// Jobs.Data["warnings"].
type SyncWarning = {
    type: string;
    user_id?: string;
    group_id?: string;
    reason: string;
};

// Warning type labels, keyed by the server-side ldap.SyncWarning type values.
const warningTypeMessages = defineMessages({
    user_update: {
        id: 'admin.ldap.jobDetails.warningType.user_update',
        defaultMessage: 'User update',
    },
    user_deactivate: {
        id: 'admin.ldap.jobDetails.warningType.user_deactivate',
        defaultMessage: 'User deactivation',
    },
    user_cpa: {
        id: 'admin.ldap.jobDetails.warningType.user_cpa',
        defaultMessage: 'Custom profile attribute update',
    },
    group_member_add: {
        id: 'admin.ldap.jobDetails.warningType.group_member_add',
        defaultMessage: 'Group member add',
    },
    group_member_remove: {
        id: 'admin.ldap.jobDetails.warningType.group_member_remove',
        defaultMessage: 'Group member removal',
    },
    group_membership_sync: {
        id: 'admin.ldap.jobDetails.warningType.group_membership_sync',
        defaultMessage: 'Group membership sync',
    },
});

const PAGE_SIZE = 10;

type Props = {
    job: Job;
    onExited: () => void;
};

const parseWarnings = (job: Job): SyncWarning[] => {
    const raw = job.data?.warnings;
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export default function LdapSyncJobDetailsModal({job, onExited}: Props): JSX.Element {
    const intl = useIntl();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(0);

    const dispatch = useDispatch();
    const allGroups = useSelector((state: GlobalState) => getAllGroups(state));
    const allUsers = useSelector((state: GlobalState) => getUsers(state));

    const warnings = useMemo(() => parseWarnings(job), [job]);
    const warningCount = parseInt(job.data?.warning_count, 10) || warnings.length;
    const isCapped = warningCount > warnings.length;

    // The warnings only carry ids, so prefetch the affected users and groups
    // for the profile popovers / group display names.
    const userIds = useMemo(
        () => Array.from(new Set(warnings.map((w) => w.user_id).filter((id): id is string => Boolean(id)))),
        [warnings],
    );
    useEffect(() => {
        if (userIds.length > 0) {
            dispatch(getMissingProfilesByIds(userIds));
        }
    }, [userIds, dispatch]);

    const groupIds = useMemo(
        () => Array.from(new Set(warnings.map((w) => w.group_id).filter((id): id is string => Boolean(id)))),
        [warnings],
    );
    useEffect(() => {
        groupIds.forEach((id) => {
            // Fetch with the member count: the group popover sizes its member
            // list by member_count, so without it the list renders empty.
            if (!allGroups[id] || allGroups[id].member_count === undefined) {
                dispatch(fetchGroup(id, true));
            }
        });

        // Only re-run when the set of ids changes; allGroups is read to avoid
        // refetching ids already present, not to trigger the effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupIds, dispatch]);

    const warningTypeLabel = useCallback((type: string): string => {
        const message = warningTypeMessages[type as keyof typeof warningTypeMessages];
        return message ? intl.formatMessage(message) : (type || '');
    }, [intl]);

    // Affected group is shown as an @-mention; fall back to the id when the
    // group has not been loaded yet.
    const groupLabel = useCallback((groupId: string): string => {
        return allGroups[groupId]?.name || groupId;
    }, [allGroups]);

    // The group popover returns focus to its trigger on close; there is no
    // persistent trigger ref to restore here, so this is a no-op.
    const returnFocusNoop = useCallback(() => {}, []);

    // Per-category counts based on the stored (capped) warnings.
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const warning of warnings) {
            counts[warning.type] = (counts[warning.type] || 0) + 1;
        }
        return counts;
    }, [warnings]);

    const filteredWarnings = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) {
            return warnings;
        }
        return warnings.filter((warning) => {
            const username = warning.user_id ? (allUsers[warning.user_id]?.username || '') : '';
            return (
                username.toLowerCase().includes(term) ||
                warningTypeLabel(warning.type).toLowerCase().includes(term) ||
                (warning.type || '').toLowerCase().includes(term) ||
                (warning.group_id ? groupLabel(warning.group_id).toLowerCase().includes(term) : false) ||
                (warning.reason || '').toLowerCase().includes(term)
            );
        });
    }, [warnings, searchTerm, warningTypeLabel, groupLabel, allUsers]);

    const totalPages = Math.ceil(filteredWarnings.length / PAGE_SIZE);
    const page = Math.min(currentPage, Math.max(totalPages - 1, 0));
    const startIndex = page * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, filteredWarnings.length);
    const paginatedWarnings = filteredWarnings.slice(startIndex, endIndex);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(0);
    };

    // Renders the affected user and/or group with the same profile/group
    // popovers used in the main message view, or null when the warning is not
    // scoped to either.
    const renderSubject = (warning: SyncWarning): React.ReactNode => {
        const parts: Array<{key: string; node: React.ReactNode}> = [];

        if (warning.user_id) {
            parts.push({
                key: 'user',
                node: (
                    <UserProfile
                        userId={warning.user_id}
                        displayUsername={true}
                        hideStatus={true}
                    />
                ),
            });
        }

        if (warning.group_id) {
            const group = allGroups[warning.group_id];
            parts.push({
                key: 'group',
                node: group ? (
                    <UserGroupPopover
                        group={group}
                        returnFocus={returnFocusNoop}
                    >
                        <a
                            className='group-mention-link'
                            role='button'
                            tabIndex={0}
                        >
                            {'@' + group.name}
                        </a>
                    </UserGroupPopover>
                ) : (
                    <span>{'@' + warning.group_id}</span>
                ),
            });
        }

        if (parts.length === 0) {
            return null;
        }

        return (
            <div className='LdapSyncJobDetailsModal__subject'>
                {parts.map((part, i) => (
                    <React.Fragment key={part.key}>
                        {i > 0 && <span className='LdapSyncJobDetailsModal__subject-separator'>{' · '}</span>}
                        {part.node}
                    </React.Fragment>
                ))}
            </div>
        );
    };

    const statusClass = job.status === JobStatuses.ERROR || job.status === JobStatuses.CANCELED ? 'status-error' : 'status-warning';

    return (
        <GenericModal
            id='ldap-sync-job-details-modal'
            className='LdapSyncJobDetailsModal'
            onExited={onExited}
            compassDesign={true}
            modalHeaderText={
                <div className='modal-header-with-status'>
                    <FormattedMessage
                        id='admin.ldap.jobDetails.title'
                        defaultMessage='Sync Job Details'
                    />
                    <div
                        className={'status-indicator ' + statusClass}
                        title={job.status}
                    />
                </div>
            }
            modalSubheaderText={
                <FormattedMessage
                    id='admin.ldap.jobDetails.subheader'
                    defaultMessage='Finished at {finishedAt}'
                    values={{
                        finishedAt: intl.formatDate(job.last_activity_at, {
                            year: 'numeric',
                            month: 'long',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        }),
                    }}
                />
            }
            show={true}
            bodyPadding={false}
        >
            <div className='LdapSyncJobDetailsModal__body'>
                {warnings.length === 0 ? (
                    <div className='LdapSyncJobDetailsModal__empty'>
                        <FormattedMessage
                            id='admin.ldap.jobDetails.noWarnings'
                            defaultMessage='No warnings were recorded for this sync job.'
                        />
                    </div>
                ) : (
                    <>
                        <div className='LdapSyncJobDetailsModal__summary'>
                            <div className='LdapSyncJobDetailsModal__summary-title'>
                                <FormattedMessage
                                    id='admin.ldap.jobDetails.summaryTitle'
                                    defaultMessage='{count, number} {count, plural, one {warning} other {warnings}}'
                                    values={{count: warningCount}}
                                />
                            </div>
                            <ul className='LdapSyncJobDetailsModal__summary-list'>
                                {Object.entries(categoryCounts).map(([type, count]) => (
                                    <li key={type}>
                                        <span className='LdapSyncJobDetailsModal__summary-type'>{warningTypeLabel(type)}</span>
                                        <span className='LdapSyncJobDetailsModal__summary-count'>{count}</span>
                                    </li>
                                ))}
                            </ul>
                            {isCapped && (
                                <div className='LdapSyncJobDetailsModal__capped-note'>
                                    <FormattedMessage
                                        id='admin.ldap.jobDetails.cappedNote'
                                        defaultMessage='Showing first {shown, number} of {total, number} warnings. Download the support packet for the full log.'
                                        values={{
                                            shown: warnings.length,
                                            total: warningCount,
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        <div className='LdapSyncJobDetailsModal__search'>
                            <LocalizedPlaceholderInput
                                type='text'
                                className='form-control'
                                value={searchTerm}
                                onChange={handleSearchChange}
                                placeholder={defineMessage({id: 'admin.ldap.jobDetails.searchPlaceholder', defaultMessage: 'Search by username, group, type, or reason'})}
                            />
                        </div>
                        <table className='LdapSyncJobDetailsModal__table'>
                            <thead>
                                <tr>
                                    <th>
                                        <FormattedMessage
                                            id='admin.ldap.jobDetails.column.warning'
                                            defaultMessage='Warning'
                                        />
                                    </th>
                                    <th>
                                        <FormattedMessage
                                            id='admin.ldap.jobDetails.column.reason'
                                            defaultMessage='Reason'
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedWarnings.length === 0 ? (
                                    <tr>
                                        <td colSpan={2}>
                                            <span className='LdapSyncJobDetailsModal__no-results'>
                                                <FormattedMessage
                                                    id='admin.ldap.jobDetails.noResults'
                                                    defaultMessage='No warnings match your search.'
                                                />
                                            </span>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedWarnings.map((warning, index) => (
                                        <tr key={startIndex + index}>
                                            <td>
                                                <div className='LdapSyncJobDetailsModal__type'>{warningTypeLabel(warning.type)}</div>
                                                {renderSubject(warning)}
                                            </td>
                                            <td className='LdapSyncJobDetailsModal__reason'>{warning.reason}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        {filteredWarnings.length > 0 && (
                            <div className='LdapSyncJobDetailsModal__footer'>
                                <FormattedMessage
                                    id='admin.data_grid.paginatorCount'
                                    defaultMessage='{startCount, number} - {endCount, number} of {total, number}'
                                    values={{
                                        startCount: startIndex + 1,
                                        endCount: endIndex,
                                        total: filteredWarnings.length,
                                    }}
                                />
                                <button
                                    type='button'
                                    className={'btn btn-quaternary btn-icon btn-sm ml-2 prev ' + (page <= 0 ? 'disabled' : '')}
                                    onClick={() => setCurrentPage(page - 1)}
                                    disabled={page <= 0}
                                    aria-label={intl.formatMessage({id: 'admin.ldap.jobDetails.prevPage', defaultMessage: 'Previous page'})}
                                >
                                    <PreviousIcon/>
                                </button>
                                <button
                                    type='button'
                                    className={'btn btn-quaternary btn-icon btn-sm next ' + (page >= totalPages - 1 ? 'disabled' : '')}
                                    onClick={() => setCurrentPage(page + 1)}
                                    disabled={page >= totalPages - 1}
                                    aria-label={intl.formatMessage({id: 'admin.ldap.jobDetails.nextPage', defaultMessage: 'Next page'})}
                                >
                                    <NextIcon/>
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </GenericModal>
    );
}
