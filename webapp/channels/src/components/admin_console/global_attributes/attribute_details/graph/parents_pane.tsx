// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {buildSuggestions, enabledSuggestionNames} from './edge_candidates';
import {EdgeList} from './edge_list';
import {
    addTopLevelOption,
    countDescendants,
    getChildren,
    isNameUnique,
    removeParentEdge,
    wouldExceedMaxEdges,
    wouldExceedMaxOptions,
    type CheckParentEdgeInvalid,
} from './graph_utils';
import {NodeMenu} from './node_menu';
import {proposeAddParent, type ConfirmGrant, type ProposeParentResult} from './parent_ops';

import './parents_pane.scss';

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
    const [view, setView] = useState<'main' | 'parents' | 'children'>(initialView);
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [edgeAlert, setEdgeAlert] = useState<CheckParentEdgeInvalid | null>(null);
    const [alertRelatedName, setAlertRelatedName] = useState('');
    const [nameDraft, setNameDraft] = useState(optionName);

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

    const edgeDirection = view === 'main' ? undefined : view;
    const enabledNames = useMemo(
        () => (edgeDirection ? enabledSuggestionNames(options, optionName, edgeDirection) : []),
        [edgeDirection, optionName, options],
    );
    const suggestions = useMemo(
        () => buildSuggestions(options, enabledNames, query, {disabled, atMax}),
        [atMax, disabled, enabledNames, options, query],
    );

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

    const handleCreateChild = useCallback(async (name: string) => {
        if (!isNameUnique(options, name) || wouldExceedMaxOptions(options) || wouldExceedMaxEdges(options) || disabled || atMax) {
            return;
        }
        applyProposeResult(
            await proposeAddParent(addTopLevelOption(options, name), name, optionName, confirmGrant),
            name,
            onChildAdded,
        );
    }, [applyProposeResult, atMax, confirmGrant, disabled, onChildAdded, optionName, options]);

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
        return (
            <EdgeList
                direction={view}
                optionName={optionName}
                relatedNames={view === 'children' ? childOptions.map((c) => c.name) : parentNames}
                query={query}
                searchOpen={searchOpen}
                suggestions={suggestions}
                edgeAlert={edgeAlert}
                alertRelatedName={alertRelatedName}
                disabled={disabled}
                atMax={atMax}
                descendantCount={countDescendants(options, optionName)}
                onBack={() => goToView('main')}
                onQueryChange={(value) => {
                    setQuery(value);
                    setSearchOpen(true);
                }}
                onSearchOpen={() => setSearchOpen(true)}
                onAddExisting={view === 'children' ? handleAddChild : handleAdd}
                onCreate={view === 'children' ? handleCreateChild : handleCreate}
                onRemoveEdge={(childName, parentName) => onOptionsChange(removeParentEdge(options, childName, parentName))}
            />
        );
    }

    return (
        <NodeMenu
            optionName={optionName}
            nameDraft={nameDraft}
            trimmedName={trimmedName}
            renameIsDuplicate={renameIsDuplicate}
            parentCount={parentNames.length}
            childCount={childOptions.length}
            disabled={disabled}
            onNameDraftChange={setNameDraft}
            onCommitRename={commitRename}
            onRevertDraft={() => setNameDraft(optionName)}
            onOpenParents={() => goToView('parents')}
            onOpenChildren={() => goToView('children')}
            onDelete={() => onDelete(optionName)}
        />
    );
}

export default AttributeGraphParentsPane;
