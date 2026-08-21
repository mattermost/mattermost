// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {components} from 'react-select';

import {ChevronLeftIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import * as Menu from 'components/menu';

import {proposeAddParent, type ConfirmGrant} from './graph_parent_ops';
import {
    checkParentEdge,
    cycleErrorValues,
    depthErrorValues,
    getChildren,
    removeParentEdge,
    type CheckParentEdgeResult,
} from './graph_utils';

import './attribute_graph_parents_pane.scss';

export type {ConfirmGrant};

export type AttributeGraphParentsPaneProps = {
    options: PropertyFieldOption[];
    optionName: string;
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    onDelete: (optionName: string) => void;
    disabled?: boolean;
    atMax?: boolean;
    confirmGrant?: ConfirmGrant;
};

export type ParentCandidateClass =
    | {kind: 'omit'} |
    {kind: 'disabled'; reason: 'self' | 'depth' | 'max-parents'} |
    {kind: 'enabled'};

type EdgeAlert = Extract<CheckParentEdgeResult, {ok: false}>;

type PickerRow =
    | {option: PropertyFieldOption; kind: 'enabled'} |
    {option: PropertyFieldOption; kind: 'disabled'; reason: 'self' | 'depth' | 'max-parents'};

export function classifyParentCandidate(
    options: PropertyFieldOption[],
    childName: string,
    candidateName: string,
): ParentCandidateClass {
    const listed = (options.find((o) => o.name === childName)?.parents ?? []).includes(candidateName);
    if (listed) {
        return {kind: 'omit'};
    }
    const result = checkParentEdge(options, childName, candidateName);
    if (!result.ok) {
        switch (result.error) {
        case 'cycle':
            return {kind: 'omit'};
        case 'self':
            return {kind: 'disabled', reason: 'self'};
        case 'depth':
            return {kind: 'disabled', reason: 'depth'};
        case 'max-parents':
            return {kind: 'disabled', reason: 'max-parents'};
        default: {
            const exhaustive: never = result;
            return exhaustive;
        }
        }
    }
    return {kind: 'enabled'};
}

export function GraphParentEdgeAlert({result, childName, parentName}: {
    result: EdgeAlert;
    childName: string;
    parentName: string;
}) {
    const {formatMessage} = useIntl();
    let text = '';
    switch (result.error) {
    case 'cycle':
        text = formatMessage(messages.cycleError, cycleErrorValues(parentName, childName));
        break;
    case 'depth':
        text = formatMessage(messages.depthError, depthErrorValues(childName, result.depth));
        break;
    case 'max-parents':
        text = formatMessage(messages.maxParentsError);
        break;
    case 'self':
        return null;
    default: {
        const exhaustive: never = result;
        return exhaustive;
    }
    }
    return (
        <div
            className='attribute-graph-parents-pane__alert'
            role='alert'
            data-testid='attributeGraphParentsPane__alert'
        >
            {text}
        </div>
    );
}

function pickerSecondaryMessage(reason: 'self' | 'depth' | 'max-parents') {
    switch (reason) {
    case 'self':
        return messages.pickerSelf;
    case 'depth':
        return messages.pickerDepth;
    case 'max-parents':
        return messages.pickerMaxParents;
    default: {
        const exhaustive: never = reason;
        return exhaustive;
    }
    }
}

function AttributeGraphParentsPane({
    options,
    optionName,
    onOptionsChange,
    onDelete,
    disabled = false,
    atMax = false,
    confirmGrant,
}: AttributeGraphParentsPaneProps) {
    const {formatMessage} = useIntl();
    const [view, setView] = useState<'main' | 'parents'>('main');
    const [query, setQuery] = useState('');
    const [edgeAlert, setEdgeAlert] = useState<EdgeAlert | null>(null);
    const [alertParentName, setAlertParentName] = useState('');

    const option = options.find((item) => item.name === optionName);
    const parentNames = option?.parents ?? [];
    const childOptions = useMemo(() => getChildren(options, optionName), [options, optionName]);

    const pickerRows = useMemo<PickerRow[]>(() => {
        const q = query.trim().toLowerCase();
        const rows: PickerRow[] = [];
        for (const candidate of options) {
            if (q && !candidate.name.toLowerCase().includes(q)) {
                continue;
            }
            const cls = classifyParentCandidate(options, optionName, candidate.name);
            if (cls.kind === 'omit') {
                continue;
            }
            if (cls.kind === 'disabled') {
                rows.push({option: candidate, kind: 'disabled', reason: cls.reason});
            } else {
                rows.push({option: candidate, kind: 'enabled'});
            }
        }
        return rows;
    }, [options, optionName, query]);

    const handleAdd = useCallback(async (parentName: string) => {
        const result = await proposeAddParent(options, optionName, parentName, confirmGrant);
        switch (result.status) {
        case 'applied':
            onOptionsChange(result.options);
            setEdgeAlert(null);
            setQuery('');
            break;
        case 'noOp':
            setEdgeAlert(null);
            setQuery('');
            break;
        case 'cancelled':
        case 'fail-closed':
            setEdgeAlert(null);
            break;
        case 'invalid':
            setEdgeAlert(result.check);
            setAlertParentName(parentName);
            break;
        default: {
            const exhaustive: never = result;
            throw exhaustive;
        }
        }
    }, [options, optionName, confirmGrant, onOptionsChange]);

    const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        event.stopPropagation();
        if (event.key !== 'Enter') {
            return;
        }
        event.preventDefault();
        if (disabled || atMax) {
            return;
        }
        const enabled = pickerRows.filter((row) => row.kind === 'enabled');
        if (enabled.length === 1) {
            handleAdd(enabled[0].option.name);
        }
    }, [atMax, disabled, handleAdd, pickerRows]);

    if (view === 'parents') {
        return (
            <>
                <button
                    type='button'
                    className='attribute-graph-parents-pane__back'
                    data-testid='attributeGraphParentsPane__back'
                    onClick={() => setView('main')}
                >
                    <ChevronLeftIcon size={16}/>
                    <FormattedMessage {...messages.back}/>
                </button>
                <div className='attribute-graph-parents-pane__chips'>
                    {parentNames.map((parentName) => (
                        <span
                            key={parentName}
                            className='attribute-graph-parents-pane__chip'
                            data-testid='attributeGraphParentsPane__chip'
                        >
                            <span className='attribute-graph-parents-pane__chip-label'>{parentName}</span>
                            <button
                                type='button'
                                className='attribute-graph-parents-pane__chip-remove'
                                data-testid='attributeGraphParentsPane__chipRemove'
                                aria-label={formatMessage(messages.removeParent, {name: parentName})}
                                disabled={disabled}
                                onClick={() => {
                                    onOptionsChange(removeParentEdge(options, optionName, parentName));
                                }}
                            >
                                <components.CrossIcon size={14}/>
                            </button>
                        </span>
                    ))}
                </div>
                <Menu.InputItem
                    key='filter-parents'
                    id='attributeGraphParentsPane__search'
                    type='text'
                    placeholder={formatMessage(messages.addParent)}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    disabled={disabled || atMax}
                    data-testid='attributeGraphParentsPane__search'
                />
                {pickerRows.map((row) => {
                    if (row.kind === 'disabled') {
                        return (
                            <Menu.Item
                                key={row.option.name}
                                id={`attributeGraphParentsPane__candidate-${row.option.name}`}
                                data-testid={`attributeGraphParentsPane__candidate-${row.option.name}`}
                                disabled={true}
                                labels={(
                                    <>
                                        <span>{row.option.name}</span>
                                        <span>{formatMessage(pickerSecondaryMessage(row.reason))}</span>
                                    </>
                                )}
                            />
                        );
                    }
                    return (
                        <Menu.Item
                            key={row.option.name}
                            id={`attributeGraphParentsPane__candidate-${row.option.name}`}
                            data-testid={`attributeGraphParentsPane__candidate-${row.option.name}`}
                            disabled={disabled || atMax}
                            disableCloseOnSelect={true}
                            onClick={() => {
                                handleAdd(row.option.name);
                            }}
                            labels={<span>{row.option.name}</span>}
                        />
                    );
                })}
                <p
                    className='attribute-graph-parents-pane__helper'
                    data-testid='attributeGraphParentsPane__helper'
                >
                    <FormattedMessage {...messages.descendantsOmittedHelper}/>
                </p>
                {edgeAlert && (
                    <GraphParentEdgeAlert
                        result={edgeAlert}
                        childName={optionName}
                        parentName={alertParentName}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <div
                className='attribute-graph-parents-pane__name'
                data-testid='attributeGraphParentsPane__name'
            >
                {optionName}
            </div>
            <Menu.Item
                id='attributeGraphParentsPane__openParents'
                data-testid='attributeGraphParentsPane__openParents'
                disableCloseOnSelect={true}
                onClick={() => setView('parents')}
                labels={<span><FormattedMessage {...messages.parents}/></span>}
                trailingElements={(
                    <>
                        {parentNames.length}
                        <ChevronRightIcon size={16}/>
                    </>
                )}
            />
            {childOptions.length > 0 && (
                <div
                    className='attribute-graph-parents-pane__children'
                    data-testid='attributeGraphParentsPane__children'
                >
                    <div className='attribute-graph-parents-pane__children-label'>
                        <FormattedMessage {...messages.children}/>
                    </div>
                    {childOptions.map((child) => (
                        <div
                            key={child.name}
                            className='attribute-graph-parents-pane__child'
                        >
                            {child.name}
                        </div>
                    ))}
                </div>
            )}
            <Menu.Separator/>
            <Menu.Item
                isDestructive={true}
                disabled={disabled}
                disableCloseOnSelect={true}
                onClick={() => onDelete(optionName)}
                labels={<span><FormattedMessage {...messages.deleteThisValue}/></span>}
            />
        </>
    );
}

export default AttributeGraphParentsPane;

const messages = defineMessages({
    parents: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.parents',
        defaultMessage: 'Parents',
    },
    children: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.children',
        defaultMessage: 'Children',
    },
    addParent: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.add_parent',
        defaultMessage: 'Add parent',
    },
    removeParent: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.remove_parent',
        defaultMessage: 'Remove parent {name}',
    },
    back: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.back',
        defaultMessage: 'Back',
    },
    descendantsOmittedHelper: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.descendants_helper',
        defaultMessage: 'Options below this one aren\'t listed — a parent can\'t be one of its own descendants.',
    },
    pickerSelf: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.picker_self',
        defaultMessage: 'same value — an option can\'t be its own parent',
    },
    pickerDepth: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.picker_depth',
        defaultMessage: 'Exceeds depth 100',
    },
    pickerMaxParents: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.picker_max_parents',
        defaultMessage: 'Parent limit reached',
    },
    cycleError: {
        id: 'admin.global_attributes.attribute_details.options.graph.parent_edge.cycle',
        defaultMessage: '{parent} can\'t be a parent of {child} — {child} already grants {parent}, so this would loop back on itself.',
    },
    depthError: {
        id: 'admin.global_attributes.attribute_details.options.graph.parent_edge.depth',
        defaultMessage: 'Adding this parent pushes "{name}" to depth {n}; the limit is 100.',
    },
    maxParentsError: {
        id: 'admin.global_attributes.attribute_details.options.graph.parent_edge.max_parents',
        defaultMessage: 'An option can have at most 100 parents.',
    },
    deleteThisValue: {
        id: 'admin.global_attributes.attribute_details.options.graph.delete_this_value',
        defaultMessage: 'Delete this value',
    },
});
