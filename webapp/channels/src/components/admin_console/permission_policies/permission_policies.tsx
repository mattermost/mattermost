// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import type {Row, Column} from 'components/admin_console/data_grid/data_grid';
import DataGrid from 'components/admin_console/data_grid/data_grid';
import * as Menu from 'components/menu';

import {getHistory} from 'utils/browser_history';

import '../access_control/policies.scss';

type Props = {
    actions: {
        searchPolicies: (term: string, after: string, limit: number) => Promise<ActionResult>;
        deletePolicy: (id: string) => Promise<ActionResult>;
    };
};

const PAGE_SIZE = 10;

const ROLE_LABELS: Record<string, string> = {
    system_guest: 'Guest users',
    system_user: 'Members and system administrators',
    system_admin: 'System administrators',
};

const ACTION_LABELS: Record<string, string> = {
    download_file_attachment: 'Download Files',
    upload_file_attachment: 'Upload Files',
};

function getActionsLabel(policy: AccessControlPolicy): string {
    const actions = policy.rules?.flatMap((r) => r.actions || []) || [];
    const unique = [...new Set(actions)];
    return unique.map((a) => ACTION_LABELS[a] || a).join(', ') || 'None';
}

function getRoleLabel(policy: AccessControlPolicy): string {
    const role = policy.roles?.[0];
    if (!role) {
        return 'None';
    }
    return ROLE_LABELS[role] || role;
}

export default function PermissionPolicyList(props: Props): JSX.Element {
    const [policies, setPolicies] = useState<AccessControlPolicy[]>([]);
    const [page, setPage] = useState(0);
    const [after, setAfter] = useState('');
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [searchErrored, setSearchErrored] = useState(false);
    const [cursorHistory, setCursorHistory] = useState<string[]>([]);
    const [total, setTotal] = useState(0);
    const intl = useIntl();

    const history = useMemo(() => getHistory(), []);

    useEffect(() => {
        fetchPolicies();
    }, []);

    const fetchPolicies = async (term = '', afterParam = '', resetPage = false) => {
        setLoading(true);

        try {
            const action = await props.actions.searchPolicies(term, afterParam, PAGE_SIZE + 1);
            if (!action?.data) {
                setLoading(false);
                setSearchErrored(true);
                return;
            }
            const data = action.data.policies || [];
            const newTotal = action.data.total || 0;

            const hasNextPage = data.length > PAGE_SIZE;
            const newPolicies = hasNextPage ? data.slice(0, PAGE_SIZE) : data;
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
        } catch {
            setLoading(false);
            setSearchErrored(true);
        }
    };

    const onSearch = async (term: string) => {
        if (term.length === 0) {
            setPage(0);
            setAfter('');
            setCursorHistory([]);
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

        const newCursorHistory = [...cursorHistory];
        newCursorHistory.pop();

        const previousCursor = newCursorHistory.length > 0 ? newCursorHistory[newCursorHistory.length - 1] : '';

        setLoading(true);
        setPage(page - 1);
        setCursorHistory(newCursorHistory);

        await fetchPolicies(search, previousCursor);
    };

    const handleDelete = async (policyId: string) => {
        await props.actions.deletePolicy(policyId);
        setPage(0);
        setCursorHistory([]);
        fetchPolicies(search, '', true);
    };

    const getRows = (): Row[] => {
        return policies.map((policy: AccessControlPolicy) => {
            return {
                cells: {
                    name: (
                        <div className='policy-name'>
                            {policy.name}
                        </div>
                    ),
                    role: (
                        <div className='policy-resources'>
                            {getRoleLabel(policy)}
                        </div>
                    ),
                    policyActions: (
                        <div className='policy-resources'>
                            {getActionsLabel(policy)}
                        </div>
                    ),
                    actions: (
                        <div className='policy-actions'>
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
                                        id: 'admin.permission_policies.menu.aria_label',
                                        defaultMessage: 'Policy actions menu',
                                    }),
                                }}
                            >
                                <Menu.Item
                                    id={`policy-menu-edit-${policy.id}`}
                                    onClick={() => {
                                        history.push(`/admin_console/system_attributes/permission_policies/edit_policy/${policy.id}`);
                                    }}
                                    leadingElement={<i className='icon icon-pencil-outline'/>}
                                    labels={
                                        <FormattedMessage
                                            id='admin.permission_policies.edit'
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
                                            id='admin.permission_policies.delete'
                                            defaultMessage='Delete'
                                        />
                                    }
                                    isDestructive={true}
                                />
                            </Menu.Container>
                        </div>
                    ),
                },
                onClick: () => {
                    history.push(`/admin_console/system_attributes/permission_policies/edit_policy/${policy.id}`);
                },
            };
        });
    };

    const getColumns = (): Column[] => {
        return [
            {
                name: (
                    <FormattedMessage
                        id='admin.permission_policies.name'
                        defaultMessage='Name'
                    />
                ),
                field: 'name',
                width: 4,
            },
            {
                name: (
                    <FormattedMessage
                        id='admin.permission_policies.role'
                        defaultMessage='Role'
                    />
                ),
                field: 'role',
                width: 2,
            },
            {
                name: (
                    <FormattedMessage
                        id='admin.permission_policies.policy_actions'
                        defaultMessage='Permissions'
                    />
                ),
                field: 'policyActions',
                width: 3,
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
            id='admin.permission_policies.no_policies_found'
            defaultMessage='No permission policies found'
        />
    );

    if (searchErrored) {
        placeholderEmpty = (
            <FormattedMessage
                id='admin.permission_policies.search_errored'
                defaultMessage='Something went wrong. Try again'
            />
        );
    }

    const rowsContainerStyles = {
        minHeight: `${rows.length * 40}px`,
    };

    return (
        <div className='PolicyTable'>
            <div className='policy-header'>
                <div className='policy-header-text'>
                    <h1>
                        <FormattedMessage
                            id='admin.permission_policies.title'
                            defaultMessage='Permission Policies'
                        />
                    </h1>
                    <p>
                        <FormattedMessage
                            id='admin.permission_policies.description'
                            defaultMessage='Create policies to control file upload and download permissions based on user attributes.'
                        />
                    </p>
                </div>
                <button
                    className='btn btn-primary'
                    onClick={() => {
                        history.push('/admin_console/system_attributes/permission_policies/edit_policy');
                    }}
                >
                    <i className='icon icon-plus'/>
                    <span>
                        <FormattedMessage
                            id='admin.permission_policies.add_policy'
                            defaultMessage='Add policy'
                        />
                    </span>
                </button>
            </div>
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
            />
        </div>
    );
}
