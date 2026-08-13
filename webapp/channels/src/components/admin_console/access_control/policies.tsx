// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import {Button} from '@mattermost/shared/components/button';
import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import type {Row, Column} from 'components/admin_console/data_grid/data_grid';
import DataGrid from 'components/admin_console/data_grid/data_grid';
import * as Menu from 'components/menu';
import SectionNotice from 'components/section_notice';

import {getHistory} from 'utils/browser_history';

import {MASKED_VALUE_TOKEN_LITERAL} from './editors/shared';

import './policies.scss';

function policyHasMaskedValues(policy: AccessControlPolicy): boolean {
    return policy.rules?.some((rule) => rule.expression?.includes(MASKED_VALUE_TOKEN_LITERAL)) ?? false;
}

type Props = {

    // The second argument reports the policy's own active flag so the team
    // assignment flow can seed the team child's auto-add from the parent policy.
    // Callers that don't need it can ignore the argument.
    onPolicySelected?: (policy: AccessControlPolicy, autoAdd?: boolean) => void;
    onPoliciesLoaded?: (count: number) => void;
    simpleMode?: boolean;
    hideHeader?: boolean;
    hideDeleteAction?: boolean;
    showRefreshButton?: boolean;
    actions: {
        searchPolicies: (term: string, type: string, after: string, limit: number) => Promise<ActionResult>;
        deletePolicy: (id: string) => Promise<ActionResult>;
    };
};

const PAGE_SIZE = 10;

export default function PolicyList(props: Props): JSX.Element {
    const [policies, setPolicies] = useState<AccessControlPolicy[]>([]);
    const [page, setPage] = useState(0);
    const [after, setAfter] = useState('');
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [searchErrored, setSearchErrored] = useState(false);
    const [cursorHistory, setCursorHistory] = useState<string[]>([]);
    const [total, setTotal] = useState(0);
    const [pendingDeletePolicy, setPendingDeletePolicy] = useState<AccessControlPolicy | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const intl = useIntl();

    const history = useMemo(() => getHistory(), []);

    useEffect(() => {
        fetchPolicies();
    }, []);

    const fetchPolicies = async (term = '', afterParam = '', resetPage = false): Promise<boolean> => {
        setLoading(true);

        try {
            const action = await props.actions.searchPolicies(term, 'parent', afterParam, PAGE_SIZE + 1);

            if (action.error) {
                setLoading(false);
                setSearchErrored(true);
                return false;
            }

            const data = action.data?.policies || [];
            const newTotal = action.data?.total || 0;

            // Check if we have more data than the page size, indicating there's a next page
            const hasNextPage = data.length > PAGE_SIZE;

            // If we have more data than needed, remove the extra item (which is used to check for next page)
            const newPolicies = hasNextPage ? data.slice(0, PAGE_SIZE) : data;

            // Get the ID of the last policy for the next cursor
            const lastPolicyId = newPolicies.length > 0 ? newPolicies[newPolicies.length - 1].id : '';

            if (resetPage) {
                setPolicies(newPolicies);
                setLoading(false);
                setAfter(lastPolicyId);
                setTotal(newTotal);
                setPage(0);
                setCursorHistory([]);
            } else {
                setPolicies(newPolicies);
                setLoading(false);
                setAfter(lastPolicyId);
                setTotal(newTotal);
            }
            props.onPoliciesLoaded?.(newTotal);
            return true;
        } catch {
            setLoading(false);
            setSearchErrored(true);
            return false;
        }
    };

    const onSearch = async (term: string) => {
        if (term.length === 0) {
            setPage(0);
            setAfter('');
            setLoading(false);
            setSearchErrored(false);
            setSearch('');
            fetchPolicies();
            return;
        }

        setLoading(true);
        setSearch(term);
        await fetchPolicies(term, '', true);
    };

    const nextPage = async () => {
        const succeeded = await fetchPolicies(search, after);
        if (succeeded) {
            setCursorHistory([...cursorHistory, after]);
            setPage(page + 1);
        }
    };

    const previousPage = async () => {
        if (cursorHistory.length === 0) {
            return;
        }

        const newCursorHistory = [...cursorHistory];
        newCursorHistory.pop();
        const previousCursor = newCursorHistory.length > 0 ? newCursorHistory[newCursorHistory.length - 1] : '';

        const succeeded = await fetchPolicies(search, previousCursor);
        if (succeeded) {
            setCursorHistory(newCursorHistory);
            setPage(page - 1);
        }
    };

    const getResources = (policy: AccessControlPolicy) => {
        const channelCount = (policy.props?.channel_count as unknown as number) || 0;
        const teamCount = (policy.props?.team_count as unknown as number) || 0;

        if (channelCount === 0 && teamCount === 0) {
            return (
                <FormattedMessage
                    id='admin.access_control.policies.resources.none'
                    defaultMessage='None'
                />
            );
        }

        const parts: React.ReactNode[] = [];
        if (channelCount > 0) {
            parts.push(
                <FormattedMessage
                    key='channels'
                    id='admin.access_control.policies.resources.channels'
                    defaultMessage='{count, number} {count, plural, one {channel} other {channels}}'
                    values={{count: channelCount}}
                />,
            );
        }
        if (teamCount > 0) {
            parts.push(
                <FormattedMessage
                    key='teams'
                    id='admin.access_control.policies.resources.teams'
                    defaultMessage='{count, number} {count, plural, one {team} other {teams}}'
                    values={{count: teamCount}}
                />,
            );
        }

        return (
            <>
                {parts.map((part, index) => (
                    <React.Fragment key={index}>
                        {index > 0 && ', '}
                        {part}
                    </React.Fragment>
                ))}
            </>
        );
    };

    const initiateDelete = useCallback((policy: AccessControlPolicy) => {
        setPendingDeletePolicy(policy);
        setDeleteError(null);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!pendingDeletePolicy) {
            return;
        }
        const result = await props.actions.deletePolicy(pendingDeletePolicy.id);
        if (result?.error) {
            // The server enforces masked-policy / permission rejections (403). Surface
            // the message in the modal so the user sees why deletion failed instead of
            // a silent close + stale list refresh.
            const errorId = result.error.server_error_id;
            if (errorId === 'app.pap.delete_policy.masked_values') {
                setDeleteError(intl.formatMessage({
                    id: 'admin.access_control.delete_policy.masked_values',
                    defaultMessage: 'You cannot delete this policy because it contains attribute values you do not have permission to view.',
                }));
            } else {
                setDeleteError(result.error.message || intl.formatMessage({
                    id: 'admin.access_control.delete_policy.generic_error',
                    defaultMessage: 'Failed to delete the policy.',
                }));
            }
            return;
        }
        setPendingDeletePolicy(null);
        setDeleteError(null);
        fetchPolicies(search);
    }, [pendingDeletePolicy, search, intl]);

    const getRows = (): Row[] => {
        return policies.map((policy: AccessControlPolicy) => {
            const descriptionId = `customDescription-${policy.id}`;
            const appliedToId = `customAppliedTo-${policy.id}`;
            return {
                cells: {
                    name: (
                        <div
                            id={descriptionId}
                            className='policy-name'
                        >
                            {policy.name}
                        </div>
                    ),
                    resources: (
                        <div
                            id={appliedToId}
                            className='policy-resources'
                        >
                            {getResources(policy)}
                        </div>
                    ),
                    actions: (
                        <div className='policy-actions'>
                            {!props.simpleMode && (
                                <Menu.Container
                                    menuButton={{
                                        id: `policy-menu-${policy.id}`,
                                        class: 'policy-menu-button',
                                        children: (
                                            <i className='icon icon-dots-vertical'/>
                                        ),
                                    }}
                                    menu={{
                                        id: `policy-menu-dropdown-${policy.id}`,
                                        'aria-label': intl.formatMessage({
                                            id: 'admin.access_control.policies.menu.aria_label',
                                            defaultMessage: 'Policy actions menu',
                                        }),
                                    }}
                                >
                                    <Menu.Item
                                        id={`policy-menu-edit-${policy.id}`}
                                        onClick={() => {
                                            if (props.onPolicySelected) {
                                                props.onPolicySelected(policy, Boolean(policy.active));
                                            } else {
                                                history.push(`/admin_console/system_attributes/membership_policies/edit_policy/${policy.id}`);
                                            }
                                        }}
                                        leadingElement={<i className='icon icon-pencil-outline'/>}
                                        labels={
                                            <FormattedMessage
                                                id='admin.access_control.edit'
                                                defaultMessage='Edit'
                                            />
                                        }
                                    />
                                    {!props.hideDeleteAction && (
                                        <Menu.Item
                                            id={`policy-menu-delete-${policy.id}`}
                                            onClick={() => initiateDelete(policy)}
                                            leadingElement={<i className='icon icon-trash-can-outline'/>}
                                            labels={
                                                <FormattedMessage
                                                    id='admin.access_control.delete'
                                                    defaultMessage='Delete'
                                                />
                                            }
                                            isDestructive={true}

                                            // Also disable when the policy contains values masked
                                            // for this caller. Mirrors the policy-details Delete
                                            // guard — server returns 403, so otherwise the modal
                                            // flow would just round-trip an error.
                                            disabled={Boolean(policy.props?.child_ids?.length) || policyHasMaskedValues(policy)}
                                        />
                                    )}
                                </Menu.Container>
                            )}
                        </div>
                    ),
                },
                onClick: () => {
                    if (props.onPolicySelected) {
                        props.onPolicySelected(policy, Boolean(policy.active));
                    } else {
                        history.push(`/admin_console/system_attributes/membership_policies/edit_policy/${policy.id}`);
                    }
                },
            };
        });
    };

    const getColumns = (): Column[] => {
        const columns: Column[] = [
            {
                name: (
                    <FormattedMessage
                        id='admin.access_control.policies.name'
                        defaultMessage='Name'
                    />
                ),
                field: 'name',
                width: 5,
            },
            {
                name: (
                    <FormattedMessage
                        id='admin.access_control.policies.applies_to'
                        defaultMessage='Applies to'
                    />
                ),
                field: 'resources',
                textAlign: 'center',
                width: 4,
            },
        ];

        columns.push({
            name: (
                <span/>
            ),
            field: 'actions',
            className: 'actions-column',
            width: 1,
        });

        return columns;
    };

    const getPaginationProps = () => {
        const startCount = (page * PAGE_SIZE) + 1;
        const endCount = (startCount + policies.length) - 1;

        return {
            startCount,
            endCount,
            total,
        };
    };

    const rows: Row[] = getRows();
    const columns: Column[] = getColumns();
    const {startCount, endCount} = getPaginationProps();

    let placeholderEmpty: JSX.Element;

    if (searchErrored) {
        placeholderEmpty = (
            <FormattedMessage
                id='admin.user_settings.policy_list.search_policy_errored'
                defaultMessage='Something went wrong. Try again'
            />
        );
    } else if (search && policies.length === 0) {
        placeholderEmpty = (
            <div className='PolicyList__no-results'>
                <FormattedMessage
                    id='admin.user_settings.policy_list.no_results_for'
                    defaultMessage='No results for "{term}"'
                    values={{term: search}}
                />
                <span className='PolicyList__no-results-hint'>
                    <FormattedMessage
                        id='admin.user_settings.policy_list.no_results_hint'
                        defaultMessage='Check the spelling or try another search.'
                    />
                </span>
            </div>
        );
    } else {
        placeholderEmpty = (
            <div className='PolicyList__no-results'>
                <FormattedMessage
                    id='admin.user_settings.policy_list.no_policies_found'
                    defaultMessage='No policies found'
                />
                <span className='PolicyList__no-results-hint'>
                    <FormattedMessage
                        id='admin.user_settings.policy_list.no_policies_hint'
                        defaultMessage='Add a new policy to get started'
                    />
                </span>
            </div>
        );
    }

    const rowsContainerStyles = {
        minHeight: `${rows.length * 40}px`,
    };

    return (
        <div className='PolicyTable'>
            {!props.simpleMode && !props.hideHeader && (
                <div className='policy-header'>
                    <div className='policy-header-text'>
                        <h1>
                            <FormattedMessage
                                id='admin.access_control.policies.title'
                                defaultMessage='Membership Policies'
                            />
                        </h1>
                        <p>
                            <FormattedMessage
                                id='admin.access_control.policies.description'
                                defaultMessage='Create policies containing attribute-based membership rules and the channels they apply to.'
                            />
                        </p>
                    </div>
                    <Button
                        emphasis='primary'
                        onClick={() => {
                            history.push('/admin_console/system_attributes/membership_policies/edit_policy');
                        }}
                    >
                        <i className='icon icon-plus'/>
                        <span>
                            <FormattedMessage
                                id='admin.access_control.policies.add_policy'
                                defaultMessage='Add policy'
                            />
                        </span>
                    </Button>
                </div>
            )}
            <DataGrid
                columns={columns}
                rows={rows}
                loading={loading}
                startCount={startCount}
                endCount={endCount}
                total={total}
                onSearch={onSearch}
                term={search}
                placeholderEmpty={placeholderEmpty}
                rowsContainerStyles={rowsContainerStyles}
                nextPage={nextPage}
                previousPage={previousPage}
                extraComponent={props.showRefreshButton ? (
                    <button
                        className='style--none policy-refresh-btn'
                        onClick={() => fetchPolicies(search, '', true)}
                        aria-label={intl.formatMessage({id: 'admin.access_control.policies.refresh', defaultMessage: 'Refresh list'})}
                        title={intl.formatMessage({id: 'admin.access_control.policies.refresh', defaultMessage: 'Refresh list'})}
                    >
                        <i className='icon icon-refresh'/>
                    </button>
                ) : undefined}
            />
            {pendingDeletePolicy && (
                <GenericModal
                    onExited={() => {
                        setPendingDeletePolicy(null);
                        setDeleteError(null);
                    }}
                    handleConfirm={confirmDelete}
                    handleCancel={() => {
                        setPendingDeletePolicy(null);
                        setDeleteError(null);
                    }}
                    modalHeaderText={
                        <FormattedMessage
                            id='admin.access_control.policy.edit_policy.delete_confirmation.title'
                            defaultMessage='Confirm Policy Deletion'
                        />
                    }
                    confirmButtonText={
                        <FormattedMessage
                            id='admin.access_control.policy.edit_policy.delete_confirmation.confirm_button'
                            defaultMessage='Delete Policy'
                        />
                    }
                    confirmButtonVariant='destructive'
                    compassDesign={true}
                >
                    <>
                        <FormattedMessage
                            id='admin.access_control.policy.edit_policy.delete_confirmation.message'
                            defaultMessage='Are you sure you want to delete this policy? This action cannot be undone.'
                        />
                        {deleteError && (
                            <div className='admin-console__warning-notice EditPolicy__masked-values-warning'>
                                <SectionNotice
                                    type='danger'
                                    title={
                                        <FormattedMessage
                                            id='admin.access_control.delete_policy.error_title'
                                            defaultMessage='Unable to delete policy'
                                        />
                                    }
                                    text={deleteError}
                                />
                            </div>
                        )}
                    </>
                </GenericModal>
            )}
        </div>
    );
}
