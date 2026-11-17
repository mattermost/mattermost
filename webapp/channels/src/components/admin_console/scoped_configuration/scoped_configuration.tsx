// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DragDropContext, Draggable, Droppable} from '@hello-pangea/dnd';
import type {DropResult} from '@hello-pangea/dnd';
import classNames from 'classnames';
import React, {useState, useEffect, useMemo, useCallback, type JSX} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {DotsVerticalIcon, DragVerticalIcon, PencilOutlineIcon, PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';
import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import DataGridSearch from 'components/admin_console/data_grid/data_grid_search';
import * as Menu from 'components/menu';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {getHistory} from 'utils/browser_history';

import {SCOPED_CONFIGURATION_EDIT_ROUTE, formatSystemSettingRuleSummary, sortPoliciesByOrder} from './settings';

import {AVAILABLE_ROLES} from '../permission_policies/roles';

import '../access_control/policies.scss';
import '../data_grid/data_grid.scss';
import './scoped_configuration.scss';

const panelMessages = defineMessages({
    title: {
        id: 'admin.scoped_configuration.title',
        defaultMessage: 'Scoped Configuration',
    },
    description: {
        id: 'admin.scoped_configuration.description',
        defaultMessage: 'Create policies to override client configuration settings for matching users and sessions.',
    },
    addPolicy: {
        id: 'admin.scoped_configuration.add_policy',
        defaultMessage: 'Add policy',
    },
});

type Props = {
    order: string[];
    actions: {
        searchPolicies: (term: string, after: string, limit: number) => Promise<ActionResult>;
        deletePolicy: (id: string) => Promise<ActionResult>;
        getPolicyOrder: () => Promise<ActionResult>;
        updatePolicyOrder: (policyIds: string[]) => Promise<ActionResult>;
    };
};

const FETCH_PAGE_SIZE = 100;

const PolicyMenuTrigger = Menu.createMenuIconButtonTrigger({size: 'small'});

function getConfigurationSummary(policy: AccessControlPolicy, formatMessage: IntlShape['formatMessage']): string {
    const summaries: string[] = [];
    const seen = new Set<string>();
    for (const rule of policy.rules || []) {
        for (const key of rule.actions || []) {
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            summaries.push(formatSystemSettingRuleSummary(key, rule.value, formatMessage));
        }
    }
    return summaries.join(', ') || 'None';
}

function getRoleLabel(policy: AccessControlPolicy, formatMessage: IntlShape['formatMessage']): string {
    const roleValue = policy.roles?.[0];
    if (!roleValue) {
        return 'None';
    }
    const role = AVAILABLE_ROLES.find((r) => r.value === roleValue);
    return role ? formatMessage(role.label) : roleValue;
}

export default function ScopedConfigurationList(props: Props): JSX.Element {
    const {order, actions} = props;
    const [policies, setPolicies] = useState<AccessControlPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [loadErrored, setLoadErrored] = useState(false);
    const [saveErrored, setSaveErrored] = useState(false);
    const intl = useIntl();

    const history = useMemo(() => getHistory(), []);

    const fetchPolicies = useCallback(async () => {
        setLoading(true);
        setLoadErrored(false);

        try {
            const all: AccessControlPolicy[] = [];
            let after = '';
            for (;;) {
                // eslint-disable-next-line no-await-in-loop
                const result = await actions.searchPolicies('', after, FETCH_PAGE_SIZE);
                if (!result?.data) {
                    setLoadErrored(true);
                    return;
                }
                const page: AccessControlPolicy[] = result.data.policies || [];
                all.push(...page);
                if (page.length < FETCH_PAGE_SIZE) {
                    break;
                }
                after = page[page.length - 1].id;
            }

            const orderResult = await actions.getPolicyOrder();
            if (orderResult?.error) {
                setLoadErrored(true);
                return;
            }

            setPolicies(all);
        } catch {
            setLoadErrored(true);
        } finally {
            setLoading(false);
        }
    }, [actions]);

    useEffect(() => {
        fetchPolicies();
    }, [fetchPolicies]);

    const orderedPolicies = useMemo(() => sortPoliciesByOrder(policies, order), [policies, order]);

    const visiblePolicies = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) {
            return orderedPolicies;
        }
        return orderedPolicies.filter((policy) => policy.name.toLowerCase().includes(term));
    }, [orderedPolicies, search]);

    const isFiltering = search.trim().length > 0;

    const handleDragEnd = useCallback(async (result: DropResult) => {
        if (!result.destination || result.destination.index === result.source.index) {
            return;
        }

        const ids = orderedPolicies.map((policy) => policy.id);
        const [moved] = ids.splice(result.source.index, 1);
        ids.splice(result.destination.index, 0, moved);

        setSaveErrored(false);
        const saved = await actions.updatePolicyOrder(ids);
        if (saved?.error) {
            setSaveErrored(true);
        }
    }, [actions, orderedPolicies]);

    const handleDelete = async (policyId: string) => {
        await actions.deletePolicy(policyId);
        fetchPolicies();
    };

    const policyMenuLabel = intl.formatMessage({
        id: 'admin.scoped_configuration.menu.aria_label',
        defaultMessage: 'Policy actions menu',
    });
    const dragHandleLabel = intl.formatMessage({
        id: 'admin.scoped_configuration.priority.drag_handle',
        defaultMessage: 'Drag to change priority',
    });

    const renderRowCells = (policy: AccessControlPolicy) => (
        <>
            <div className='DataGrid_cell ScopedConfigurationPriority__priority'>
                <span
                    className='ScopedConfigurationPriority__rank'
                    data-testid={`scoped-policy-priority-${policy.id}`}
                >
                    {orderedPolicies.indexOf(policy) + 1}
                </span>
            </div>
            <div
                className='DataGrid_cell'
                style={{flexGrow: 4}}
            >
                <div className='policy-name'>
                    {policy.name}
                </div>
            </div>
            <div
                className='DataGrid_cell'
                style={{flexGrow: 2}}
            >
                <div className='policy-resources'>
                    {getRoleLabel(policy, intl.formatMessage)}
                </div>
            </div>
            <div
                className='DataGrid_cell'
                style={{flexGrow: 3}}
            >
                <div className='policy-resources'>
                    {getConfigurationSummary(policy, intl.formatMessage)}
                </div>
            </div>
            <div
                className='DataGrid_cell actions-column'
                style={{flexGrow: 1}}
            >
                <div className='policy-actions'>
                    <Menu.Container
                        menuButton={{
                            id: `scoped-policy-menu-${policy.id}`,
                            as: PolicyMenuTrigger,
                            'aria-label': policyMenuLabel,
                            children: <Icon glyph={<DotsVerticalIcon/>}/>,
                        }}
                        menuButtonTooltip={{
                            text: policyMenuLabel,
                        }}
                        menu={{
                            id: `scoped-policy-menu-dropdown-${policy.id}`,
                            'aria-label': policyMenuLabel,
                        }}
                    >
                        <Menu.Item
                            id={`scoped-policy-menu-edit-${policy.id}`}
                            onClick={() => {
                                history.push(`${SCOPED_CONFIGURATION_EDIT_ROUTE}/${policy.id}`);
                            }}
                            leadingElement={<PencilOutlineIcon size={18}/>}
                            labels={
                                <FormattedMessage
                                    id='admin.scoped_configuration.edit'
                                    defaultMessage='Edit'
                                />
                            }
                        />
                        <Menu.Item
                            id={`scoped-policy-menu-delete-${policy.id}`}
                            onClick={() => handleDelete(policy.id)}
                            leadingElement={<TrashCanOutlineIcon size={18}/>}
                            labels={
                                <FormattedMessage
                                    id='admin.scoped_configuration.delete'
                                    defaultMessage='Delete'
                                />
                            }
                            isDestructive={true}
                        />
                    </Menu.Container>
                </div>
            </div>
        </>
    );

    let rows: JSX.Element;
    if (loading) {
        rows = (
            <div className='DataGrid_loading'>
                <LoadingSpinner/>
                <FormattedMessage
                    id='admin.data_grid.loading'
                    defaultMessage='Loading'
                />
            </div>
        );
    } else if (loadErrored) {
        rows = (
            <div className='DataGrid_empty'>
                <FormattedMessage
                    id='admin.scoped_configuration.search_errored'
                    defaultMessage='Something went wrong. Try again'
                />
            </div>
        );
    } else if (visiblePolicies.length === 0) {
        rows = (
            <div className='DataGrid_empty'>
                <FormattedMessage
                    id='admin.scoped_configuration.no_policies_found'
                    defaultMessage='No scoped configuration policies found'
                />
            </div>
        );
    } else {
        rows = (
            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId='scoped-configuration-priority'>
                    {(droppableProvided) => (
                        <div
                            ref={droppableProvided.innerRef}
                            {...droppableProvided.droppableProps}
                            className='DataGrid_rows'
                            data-testid='dataGrid-rows'
                        >
                            {visiblePolicies.map((policy, index) => (
                                <Draggable
                                    key={policy.id}
                                    draggableId={policy.id}
                                    index={index}
                                    isDragDisabled={isFiltering}
                                >
                                    {(draggableProvided, snapshot) => (
                                        <div
                                            ref={draggableProvided.innerRef}
                                            {...draggableProvided.draggableProps}
                                            className={classNames('DataGrid_row', 'ScopedConfigurationPriority__row', {
                                                'ScopedConfigurationPriority__row--dragging': snapshot.isDragging,
                                            })}
                                            data-testid='dataGrid-row'
                                            onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('.ScopedConfigurationPriority__handle')) {
                                                    return;
                                                }
                                                history.push(`${SCOPED_CONFIGURATION_EDIT_ROUTE}/${policy.id}`);
                                            }}
                                        >
                                            <div className='DataGrid_cell ScopedConfigurationPriority__handle-cell'>
                                                <span
                                                    {...draggableProvided.dragHandleProps}
                                                    className={classNames('ScopedConfigurationPriority__handle', {
                                                        'ScopedConfigurationPriority__handle--disabled': isFiltering,
                                                    })}
                                                    aria-label={dragHandleLabel}
                                                    data-testid={`scoped-policy-drag-handle-${policy.id}`}
                                                >
                                                    <DragVerticalIcon size={18}/>
                                                </span>
                                            </div>
                                            {renderRowCells(policy)}
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {droppableProvided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        );
    }

    return (
        <AdminPanel
            id='scoped_configuration'
            className='PolicyTable'
            title={panelMessages.title}
            subtitle={panelMessages.description}
            button={
                <Button
                    emphasis='primary'
                    onClick={() => {
                        history.push(SCOPED_CONFIGURATION_EDIT_ROUTE);
                    }}
                    leadingIcon={<Icon glyph={<PlusIcon/>}/>}
                >
                    <span>
                        <FormattedMessage {...panelMessages.addPolicy}/>
                    </span>
                </Button>
            }
        >
            <div
                className='DataGrid ScopedConfigurationPriority'
                data-testid='dataGrid'
            >
                <DataGridSearch
                    onSearch={setSearch}
                    term={search}
                />
                <div className='ScopedConfigurationPriority__hint'>
                    {isFiltering ? (
                        <FormattedMessage
                            id='admin.scoped_configuration.priority.filtering'
                            defaultMessage='Clear the search to change the priority of policies.'
                        />
                    ) : (
                        <FormattedMessage
                            id='admin.scoped_configuration.priority.explanation'
                            defaultMessage='When a user matches more than one policy for a setting, the policy highest in this list applies. Drag policies to change their priority.'
                        />
                    )}
                </div>
                {saveErrored && (
                    <div
                        className='ScopedConfigurationPriority__error'
                        role='alert'
                    >
                        <FormattedMessage
                            id='admin.scoped_configuration.priority.save_error'
                            defaultMessage='Unable to save the new priority order. Try again.'
                        />
                    </div>
                )}
                <div
                    className='DataGrid_header'
                    data-testid='dataGrid-header'
                >
                    <div className='DataGrid_cell ScopedConfigurationPriority__handle-cell'/>
                    <div className='DataGrid_cell ScopedConfigurationPriority__priority'>
                        <FormattedMessage
                            id='admin.scoped_configuration.priority'
                            defaultMessage='Priority'
                        />
                    </div>
                    <div
                        className='DataGrid_cell'
                        style={{flexGrow: 4}}
                    >
                        <FormattedMessage
                            id='admin.scoped_configuration.name'
                            defaultMessage='Name'
                        />
                    </div>
                    <div
                        className='DataGrid_cell'
                        style={{flexGrow: 2}}
                    >
                        <FormattedMessage
                            id='admin.scoped_configuration.role'
                            defaultMessage='Role'
                        />
                    </div>
                    <div
                        className='DataGrid_cell'
                        style={{flexGrow: 3}}
                    >
                        <FormattedMessage
                            id='admin.scoped_configuration.configuration_column'
                            defaultMessage='Configuration'
                        />
                    </div>
                    <div
                        className='DataGrid_cell actions-column'
                        style={{flexGrow: 1}}
                    />
                </div>
                {rows}
            </div>
        </AdminPanel>
    );
}
