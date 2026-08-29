// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {
    ChevronLeftIcon,
    ChevronRightIcon,
    CloseIcon,
    PlusIcon,
    SitemapIcon,
    SourceBranchIcon,
    TrashCanOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';

import Constants from 'utils/constants';

import {proposeAddParent, type ConfirmGrant, type ProposeParentResult} from './graph_parent_ops';
import {
    addChildOption,
    addTopLevelOption,
    checkParentEdge,
    cycleErrorValues,
    depthErrorValues,
    getChildren,
    isNameUnique,
    removeParentEdge,
    wouldExceedMaxEdges,
    wouldExceedMaxOptions,
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
    initialView?: 'main' | 'parents' | 'children';
    onRename?: (currentName: string, nextName: string) => 'applied' | 'duplicate' | 'noop';
    onChildAdded?: () => void;
};

export type ParentCandidateClass =
    | {kind: 'omit'} |
    {kind: 'disabled'; reason: 'self' | 'depth' | 'max-parents'} |
    {kind: 'enabled'};

type EdgeAlert = Extract<CheckParentEdgeResult, {ok: false}>;

type Suggestion =
    {kind: 'existing'; name: string} |
    {kind: 'create'; name: string};

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

export function classifyChildCandidate(
    options: PropertyFieldOption[],
    parentName: string,
    candidateName: string,
): ParentCandidateClass {
    return classifyParentCandidate(options, candidateName, parentName);
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

function AttributeGraphParentsPane({
    options,
    optionName,
    onOptionsChange,
    onDelete,
    disabled = false,
    atMax = false,
    confirmGrant,
    initialView = 'main',
    onRename,
    onChildAdded,
}: AttributeGraphParentsPaneProps) {
    const {formatMessage} = useIntl();
    const [view, setView] = useState<'main' | 'parents' | 'children'>(initialView);
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [edgeAlert, setEdgeAlert] = useState<EdgeAlert | null>(null);
    const [alertRelatedName, setAlertRelatedName] = useState('');
    const [nameDraft, setNameDraft] = useState(optionName);
    const skipBlurCommitRef = useRef(false);

    useEffect(() => {
        setNameDraft(optionName);
    }, [optionName]);

    const option = options.find((item) => item.name === optionName);
    const parentNames = option?.parents ?? [];
    const childOptions = useMemo(() => getChildren(options, optionName), [options, optionName]);
    const trimmedName = nameDraft.trim();
    const renameIsDuplicate = Boolean(trimmedName) && trimmedName !== optionName && !isNameUnique(options, trimmedName, optionName);

    const goToView = useCallback((next: 'main' | 'parents' | 'children') => {
        setView(next);
        setQuery('');
        setSearchOpen(false);
        setEdgeAlert(null);
    }, []);

    const suggestions = useMemo<Suggestion[]>(() => {
        const q = query.trim();
        const qLower = q.toLowerCase();
        const items: Suggestion[] = [];
        for (const candidate of options) {
            if (q && !candidate.name.toLowerCase().includes(qLower)) {
                continue;
            }
            const classification = view === 'children' ?
                classifyChildCandidate(options, optionName, candidate.name) :
                classifyParentCandidate(options, optionName, candidate.name);
            if (classification.kind !== 'enabled') {
                continue;
            }
            items.push({kind: 'existing', name: candidate.name});
        }
        if (q && isNameUnique(options, q) && !disabled && !atMax && !wouldExceedMaxOptions(options) && !wouldExceedMaxEdges(options)) {
            items.push({kind: 'create', name: q});
        }
        return items;
    }, [atMax, disabled, optionName, options, query, view]);

    const applyProposeResult = useCallback((result: ProposeParentResult, relatedName: string, onApplied?: () => void) => {
        switch (result.status) {
        case 'applied':
            onOptionsChange(result.options);
            onApplied?.();
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
            setAlertRelatedName(relatedName);
            break;
        default: {
            const exhaustive: never = result;
            throw exhaustive;
        }
        }
    }, [onOptionsChange]);

    const handleAdd = useCallback(async (parentName: string, fromOptions = options) => {
        applyProposeResult(await proposeAddParent(fromOptions, optionName, parentName, confirmGrant), parentName);
    }, [applyProposeResult, confirmGrant, optionName, options]);

    const handleCreate = useCallback(async (name: string) => {
        if (!isNameUnique(options, name) || wouldExceedMaxOptions(options) || wouldExceedMaxEdges(options) || disabled || atMax) {
            return;
        }
        await handleAdd(name, addTopLevelOption(options, name));
    }, [atMax, disabled, handleAdd, options]);

    const handleAddChild = useCallback(async (childName: string) => {
        applyProposeResult(await proposeAddParent(options, childName, optionName, confirmGrant), childName, onChildAdded);
    }, [applyProposeResult, confirmGrant, onChildAdded, optionName, options]);

    const handleCreateChild = useCallback((name: string) => {
        if (!isNameUnique(options, name) || wouldExceedMaxOptions(options) || wouldExceedMaxEdges(options) || disabled || atMax) {
            return;
        }
        onOptionsChange(addChildOption(options, name, optionName));
        onChildAdded?.();
        setEdgeAlert(null);
        setQuery('');
    }, [atMax, disabled, onChildAdded, onOptionsChange, optionName, options]);

    const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        event.stopPropagation();
        if (event.key !== 'Enter') {
            return;
        }
        event.preventDefault();
        if (disabled || atMax) {
            return;
        }
        const existing = suggestions.filter((row) => row.kind === 'existing');
        const create = suggestions.find((row) => row.kind === 'create');
        const addExisting = view === 'children' ? handleAddChild : handleAdd;
        const createNew = view === 'children' ? handleCreateChild : handleCreate;
        if (existing.length === 1 && !create) {
            addExisting(existing[0].name);
            return;
        }
        if (existing.length === 0 && create) {
            createNew(create.name);
        }
    }, [atMax, disabled, handleAdd, handleAddChild, handleCreate, handleCreateChild, suggestions, view]);

    const commitRename = useCallback(() => {
        if (!onRename) {
            setNameDraft(optionName);
            return;
        }
        const result = onRename(optionName, nameDraft);
        if (result === 'noop') {
            setNameDraft(optionName);
        }
    }, [nameDraft, onRename, optionName]);

    if (view === 'parents' || view === 'children') {
        const isChildren = view === 'children';
        const relatedNames = isChildren ? childOptions.map((child) => child.name) : parentNames;
        const showSuggestions = searchOpen && suggestions.length > 0 && !disabled;
        const addExisting = isChildren ? handleAddChild : handleAdd;
        const createNew = isChildren ? handleCreateChild : handleCreate;

        return (
            <>
                <button
                    type='button'
                    className='attribute-graph-parents-pane__back'
                    data-testid='attributeGraphParentsPane__back'
                    onClick={() => goToView('main')}
                >
                    <ChevronLeftIcon size={16}/>
                    <FormattedMessage
                        {...(isChildren ? messages.childrenOf : messages.parentsOf)}
                        values={{name: optionName}}
                    />
                </button>
                <div className='attribute-graph-parents-pane__rows'>
                    {relatedNames.length === 0 && (
                        <p
                            className='attribute-graph-parents-pane__empty'
                            data-testid={isChildren ? 'attributeGraphParentsPane__childrenEmpty' : 'attributeGraphParentsPane__empty'}
                        >
                            <FormattedMessage {...(isChildren ? messages.noChildrenYet : messages.noParentsYet)}/>
                        </p>
                    )}
                    {relatedNames.map((relatedName) => (
                        <div
                            key={relatedName}
                            className='attribute-graph-parents-pane__row'
                            data-testid={isChildren ? 'attributeGraphParentsPane__childRow' : 'attributeGraphParentsPane__parentRow'}
                        >
                            <span className='attribute-graph-parents-pane__row-label'>{relatedName}</span>
                            <button
                                type='button'
                                className='attribute-graph-parents-pane__row-remove'
                                data-testid={isChildren ? 'attributeGraphParentsPane__childRemove' : 'attributeGraphParentsPane__parentRemove'}
                                aria-label={isChildren ?
                                    formatMessage(messages.removeChild, {parent: optionName, child: relatedName}) :
                                    formatMessage(messages.removeParent, {parent: relatedName, child: optionName})}
                                disabled={disabled}
                                onClick={() => {
                                    onOptionsChange(isChildren ?
                                        removeParentEdge(options, relatedName, optionName) :
                                        removeParentEdge(options, optionName, relatedName));
                                }}
                            >
                                <CloseIcon
                                    size={12}
                                    aria-hidden={true}
                                />
                            </button>
                        </div>
                    ))}
                </div>
                {edgeAlert && (
                    <GraphParentEdgeAlert
                        result={edgeAlert}
                        childName={isChildren ? alertRelatedName : optionName}
                        parentName={isChildren ? optionName : alertRelatedName}
                    />
                )}
                <Menu.Separator/>
                <div className='attribute-graph-parents-pane__combobox'>
                    <Input
                        name={isChildren ? 'attributeGraphParentsPane__childSearch' : 'attributeGraphParentsPane__search'}
                        type='text'
                        useLegend={false}
                        placeholder={formatMessage(isChildren ? messages.addChildPlaceholder : messages.addParentPlaceholder)}
                        aria-label={formatMessage(isChildren ? messages.addChildAria : messages.addParentAria, {name: optionName})}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setSearchOpen(true);
                        }}
                        onFocus={() => setSearchOpen(true)}
                        onKeyDown={handleSearchKeyDown}
                        onKeyUp={(event) => event.stopPropagation()}
                        disabled={disabled || atMax}
                        autoComplete='off'
                        data-testid={isChildren ? 'attributeGraphParentsPane__childSearch' : 'attributeGraphParentsPane__search'}
                    />
                    {showSuggestions && (
                        <ul
                            className='attribute-graph-parents-pane__suggestions'
                            role='listbox'
                            data-testid={isChildren ? 'attributeGraphParentsPane__childSuggestions' : 'attributeGraphParentsPane__suggestions'}
                        >
                            {suggestions.map((row) => {
                                if (row.kind === 'create') {
                                    return (
                                        <li
                                            key='__create'
                                            role='option'
                                        >
                                            <button
                                                type='button'
                                                className='attribute-graph-parents-pane__suggestion attribute-graph-parents-pane__suggestion--create'
                                                data-testid={isChildren ? 'attributeGraphParentsPane__createChild' : 'attributeGraphParentsPane__create'}
                                                disabled={disabled || atMax}
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => createNew(row.name)}
                                            >
                                                <PlusIcon
                                                    size={16}
                                                    aria-hidden={true}
                                                />
                                                <FormattedMessage
                                                    {...messages.createParent}
                                                    values={{name: row.name}}
                                                />
                                            </button>
                                        </li>
                                    );
                                }
                                return (
                                    <li
                                        key={row.name}
                                        role='option'
                                    >
                                        <button
                                            type='button'
                                            className='attribute-graph-parents-pane__suggestion'
                                            data-testid={`attributeGraphParentsPane__candidate-${row.name}`}
                                            disabled={disabled || atMax}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => addExisting(row.name)}
                                        >
                                            {row.name}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </>
        );
    }

    return (
        <>
            {disabled ? (
                <div
                    className='attribute-graph-parents-pane__name'
                    data-testid='attributeGraphParentsPane__name'
                >
                    {optionName}
                </div>
            ) : (
                <div className='attribute-graph-parents-pane__name-field'>
                    <Input
                        name='attributeGraphParentsPane__nameInput'
                        type='text'
                        useLegend={false}
                        value={nameDraft}
                        aria-label={formatMessage(messages.valueName)}
                        onChange={(event) => setNameDraft(event.target.value)}
                        onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                skipBlurCommitRef.current = true;
                                setNameDraft(optionName);
                                return;
                            }
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                skipBlurCommitRef.current = true;
                                commitRename();
                            }
                        }}
                        onKeyUp={(event) => event.stopPropagation()}
                        onBlur={() => {
                            if (skipBlurCommitRef.current) {
                                skipBlurCommitRef.current = false;
                                return;
                            }
                            commitRename();
                        }}
                        maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                        hasError={renameIsDuplicate}
                        customMessage={renameIsDuplicate ?
                            {type: 'error', value: formatMessage(messages.duplicateName, {name: trimmedName})} :
                            null}
                        data-testid='attributeGraphParentsPane__nameInput'
                        autoFocus={true}
                    />
                </div>
            )}
            <Menu.Item
                id='attributeGraphParentsPane__openParents'
                data-testid='attributeGraphParentsPane__openParents'
                disableCloseOnSelect={true}
                onClick={() => goToView('parents')}
                leadingElement={
                    <SitemapIcon
                        size={16}
                        aria-hidden={true}
                    />
                }
                labels={<span><FormattedMessage {...messages.parents}/></span>}
                trailingElements={(
                    <>
                        <span className='attribute-graph-parents-pane__nav-value'>
                            {parentNames.length === 0 ? (
                                <FormattedMessage {...messages.topLevel}/>
                            ) : (
                                <FormattedMessage
                                    {...messages.parentCount}
                                    values={{n: parentNames.length}}
                                />
                            )}
                        </span>
                        <ChevronRightIcon size={16}/>
                    </>
                )}
            />
            <Menu.Item
                id='attributeGraphParentsPane__openChildren'
                data-testid='attributeGraphParentsPane__openChildren'
                disableCloseOnSelect={true}
                onClick={() => goToView('children')}
                leadingElement={
                    <SourceBranchIcon
                        size={16}
                        aria-hidden={true}
                    />
                }
                labels={<span><FormattedMessage {...messages.children}/></span>}
                trailingElements={(
                    <>
                        <span className='attribute-graph-parents-pane__nav-value'>
                            {childOptions.length === 0 ? (
                                <FormattedMessage {...messages.none}/>
                            ) : (
                                childOptions.length
                            )}
                        </span>
                        <ChevronRightIcon size={16}/>
                    </>
                )}
            />
            <Menu.Separator/>
            <Menu.Item
                isDestructive={true}
                disabled={disabled}
                disableCloseOnSelect={true}
                onClick={() => onDelete(optionName)}
                leadingElement={
                    <TrashCanOutlineIcon
                        size={16}
                        aria-hidden={true}
                    />
                }
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
    childrenOf: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.children_back',
        defaultMessage: 'Children of {name}',
    },
    parentsOf: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.back',
        defaultMessage: 'Parents of {name}',
    },
    noParentsYet: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.no_parents',
        defaultMessage: 'No parents yet.',
    },
    noChildrenYet: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.no_children',
        defaultMessage: 'No children yet.',
    },
    addChildPlaceholder: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.add_child',
        defaultMessage: 'Grant another value, or type a new name…',
    },
    addChildAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.add_child_aria',
        defaultMessage: 'Add a value granted by {name}',
    },
    removeChild: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.remove_child',
        defaultMessage: 'Remove {child} as a child of {parent}',
    },
    topLevel: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.top_level',
        defaultMessage: 'Top level',
    },
    none: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.none',
        defaultMessage: 'None',
    },
    parentCount: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.parent_count',
        defaultMessage: '{n, plural, one {# parent} other {# parents}}',
    },
    valueName: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.value_name',
        defaultMessage: 'Value name',
    },
    duplicateName: {
        id: 'admin.global_attributes.attribute_details.options.graph.duplicate_name',
        defaultMessage: '"{name}" already exists in this field.',
    },
    addParentPlaceholder: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.add_parent',
        defaultMessage: 'Add a parent, or type a new name…',
    },
    addParentAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.add_parent_aria',
        defaultMessage: 'Add a parent of {name}',
    },
    createParent: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.create_parent',
        defaultMessage: 'Create "{name}"',
    },
    removeParent: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.remove_parent',
        defaultMessage: 'Remove {parent} as a parent of {child}',
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
