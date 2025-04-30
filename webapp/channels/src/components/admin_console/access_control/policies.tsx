// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useRef} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlPolicy} from '@mattermost/types/admin';

import type {ActionResult} from 'mattermost-redux/types/actions';

import type {Row, Column} from 'components/admin_console/data_grid/data_grid';
import DataGrid from 'components/admin_console/data_grid/data_grid';
import * as Menu from 'components/menu';

import {getHistory} from 'utils/browser_history';

import './policies.scss';

type Props = {
    onPolicySelected: (policy: AccessControlPolicy) => void;
    simpleMode: boolean;
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

    const mounted = useRef(false);

    useEffect(() => {
        mounted.current = true;
        fetchPolicies();
        return () => {
            mounted.current = false;
        };
    }, []);

    const fetchPolicies = async (term = '', afterParam = '', resetPage = false) => {
        if (!mounted.current) {
            return;
        }

        setLoading(true);

        try {
            const action = await props.actions.searchPolicies(term, 'parent', afterParam, PAGE_SIZE + 1);
            const data = action.data.policies || [];
            const newTotal = action.data.total || 0;

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
        } catch (error) {
            setLoading(false);
            setSearchErrored(true);
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
        // Save current cursor to history for "previous" navigation
        const newCursorHistory = [...cursorHistory, after];

        setLoading(true);
        setPage(page + 1);
        setCursorHistory(newCursorHistory);

        await fetchPolicies(search, after);
    };

    const previousPage = async () => {
        if (cursorHistory.length === 0) {
            return;
        }

        // Remove the current cursor from history
        const newCursorHistory = [...cursorHistory];
        newCursorHistory.pop();

        // Get the previous cursor
        const previousCursor = newCursorHistory.length > 0 ? newCursorHistory[newCursorHistory.length - 1] : '';

        setLoading(true);
        setPage(page - 1);
        setCursorHistory(newCursorHistory);

        await fetchPolicies(search, previousCursor);
    };

    const getResources = (policy: AccessControlPolicy) => {
        let resources = '-';

        const childIds = policy.props?.child_ids;
        if (childIds) {
            if (childIds.length > 1) {
                resources = `${childIds.length} channels`;
            } else if (childIds.length === 1) {
                resources = '1 channel';
            } else {
                resources = 'None';
            }
        }
        return resources;
    };

    const handleDelete = async (policyId: string) => {
        await props.actions.deletePolicy(policyId);
        fetchPolicies(search);
    };

    const getRows = (): Row[] => {
        if (!policies.length) {
            return [];
        }

        return policies.map((policy: AccessControlPolicy) => {
            const desciptionId = `customDescription-${policy.id}`;
            const appliedToId = `customAppliedTo-${policy.id}`;
            return {
                cells: {
                    name: (
                        <div
                            id={desciptionId}
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
                                    'aria-label': 'Policy actions menu',
                                }}
                            >
                                <Menu.Item
                                    id={`policy-menu-edit-${policy.id}`}
                                    onClick={() => {
                                        getHistory().push(`/admin_console/user_management/attribute_based_access_control/edit_policy/${policy.id}`);
                                    }}
                                    leadingElement={<i className='icon icon-pencil-outline'/>}
                                    labels={
                                        <FormattedMessage
                                            id='admin.access_control.edit'
                                            defaultMessage='Edit'
                                        />
                                    }
                                />
                                <Menu.Item
                                    id={`policy-menu-delete-${policy.id}`}
                                    onClick={() => handleDelete(policy.id)}
                                    leadingElement={<i className='icon icon-trash-can-outline'/>}
                                    labels={
                                        <FormattedMessage
                                            id='admin.access_control.delete'
                                            defaultMessage='Delete'
                                        />
                                    }
                                    isDestructive={true}
                                    disabled={Boolean(policy.props?.child_ids?.length)}
                                />
                            </Menu.Container>
                            )}
                        </div>
                    ),
                },
                onClick: () => {
                    props.onPolicySelected(policy);
                },
            };
        });
    };

    const getColumns = (): Column[] => {
        return [
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
            {
                name: (
                    <span/>
                ),
                field: 'actions',
                className: 'actions-column',
                width: 1,
            },
        ];
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

    let placeholderEmpty: JSX.Element = (
        <FormattedMessage
            id='admin.user_settings.policy_list.no_policies_found'
            defaultMessage='No policies found'
        />
    );

    if (searchErrored) {
        placeholderEmpty = (
            <FormattedMessage
                id='admin.user_settings.policy_list.search_policy_errored'
                defaultMessage='Something went wrong. Try again'
            />
        );
    }

    const rowsContainerStyles = {
        minHeight: `${rows.length * 40}px`,
    };

    return (
        <div className='PolicyTable'>
            {!props.simpleMode && (
                <div className='policy-header'>
                    <div className='policy-header-text'>
                        <h1>{'Access policies'}</h1>
                        <p>{'Create policies containing attribute based access rules and the objects they apply to.'}</p>
                    </div>
                    <button
                        className='btn btn-primary'
                        onClick={() => {
                            getHistory().push('/admin_console/user_management/attribute_based_access_control/edit_policy');
                        }}
                    >
                    <i className='icon icon-plus'/>
                        <span>{'Add policy'}</span>
                    </button>
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
                page={page}
                nextPage={nextPage}
                previousPage={previousPage}
            />
        </div>
    );
}
