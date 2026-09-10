// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {defineMessages, FormattedMessage} from 'react-intl';

import {SitemapIcon} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import {canvasOccurrenceKey, expandOccurrences, indexOptions} from 'components/property_fields/graph';
import type {GraphIndex, GraphOccurrence} from 'components/property_fields/graph';

import {useGraphNodeDelete} from './delete_modal';
import {AddTopLevelForm, ChildDraftRow} from './draft_forms';
import {GraphParentEdgeAlert} from './edge_alert';
import {useGrantConfirm} from './grant_confirm_modal';
import type {GrantConfirmRequest} from './parent_ops';
import {GraphRow, type GraphPaneView} from './graph_row';
import {
    addChildOption,
    addTopLevelOption,
    isNameUnique,
    renameOption,
    wouldExceedMaxEdges,
    wouldExceedMaxOptions,
} from './graph_utils';
import {
    expandAncestorsForOption,
    flattenOccurrenceTree,
    isHiddenByCollapsedAncestor,
    occurrencePath,
    remapOccurrenceKey,
    subtreeInsertAfterIndex,
} from './occurrences';
import type {ProposeParentResult} from './parent_ops';
import {dropAlertFromProposeResult, type GraphDropAlert} from './use_graph_dnd';

import './graph_values.scss';

type Props = {
    options: PropertyFieldOption[];
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    disabled?: boolean;
};

type ChildDraft = {
    parentName: string;
    insertAfterIndex: number;
    depth: number;
};

const DROP_ALERT_TIMEOUT_MS = 4000;
const ROW_HIGHLIGHT_TIMEOUT_MS = 1800;

function parentNameOf(occurrence: GraphOccurrence, graphIndex: GraphIndex): string | null {
    if (occurrence.parentKey === null) {
        return null;
    }
    return graphIndex.byId.get(occurrence.parentKey)?.name ?? occurrence.parentKey;
}

function focusGraphRow(
    optionName: string,
    occurrences: GraphOccurrence[],
    refs: Map<string, HTMLLIElement>,
): void {
    const occurrence = occurrences.find((row) => row.option.name === optionName);
    const el = occurrence && refs.get(occurrence.key);
    if (!el) {
        return;
    }
    el.scrollIntoView({block: 'nearest'});
    el.focus();
}

const AttributeOptionsGraphValues = ({options, onOptionsChange, disabled = false}: Props) => {
    const confirmGrantRaw = useGrantConfirm();
    const [draftName, setDraftName] = useState('');
    const [openPane, setOpenPane] = useState<{key: string; view: GraphPaneView} | null>(null);
    const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => new Set());
    const [childDraft, setChildDraft] = useState<ChildDraft | null>(null);
    const [childDraftName, setChildDraftName] = useState('');
    const [dropAlert, setDropAlert] = useState<GraphDropAlert | null>(null);
    const [highlightedOptionName, setHighlightedOptionName] = useState<string | null>(null);
    const dropAlertTimeoutRef = useRef<number | null>(null);
    const highlightTimeoutRef = useRef<number | null>(null);
    const rowRefs = useRef(new Map<string, HTMLLIElement>());

    const clearDropAlert = useCallback(() => {
        if (dropAlertTimeoutRef.current !== null) {
            window.clearTimeout(dropAlertTimeoutRef.current);
            dropAlertTimeoutRef.current = null;
        }
        setDropAlert(null);
    }, []);

    const clearRowHighlight = useCallback(() => {
        if (highlightTimeoutRef.current !== null) {
            window.clearTimeout(highlightTimeoutRef.current);
            highlightTimeoutRef.current = null;
        }
        setHighlightedOptionName(null);
    }, []);

    const handleDropResult = useCallback((
        result: ProposeParentResult,
        names: {childName: string; parentName: string},
    ) => {
        const nextAlert = dropAlertFromProposeResult(result, names);
        if (!nextAlert) {
            clearDropAlert();
            return;
        }
        setDropAlert(nextAlert);
        if (dropAlertTimeoutRef.current !== null) {
            window.clearTimeout(dropAlertTimeoutRef.current);
        }
        dropAlertTimeoutRef.current = window.setTimeout(() => {
            setDropAlert(null);
            dropAlertTimeoutRef.current = null;
        }, DROP_ALERT_TIMEOUT_MS);
    }, [clearDropAlert]);

    useEffect(() => {
        return () => {
            clearDropAlert();
            clearRowHighlight();
        };
    }, [clearDropAlert, clearRowHighlight]);

    const graphIndex = useMemo(() => indexOptions(options), [options]);
    const occurrences = useMemo(
        () => flattenOccurrenceTree(expandOccurrences(graphIndex, {keyOf: canvasOccurrenceKey})),
        [graphIndex],
    );

    const trimmed = draftName.trim();
    const nameIsUnique = useMemo(() => isNameUnique(options, trimmed), [options, trimmed]);
    const isDuplicate = Boolean(trimmed) && !nameIsUnique;
    const atMax = useMemo(
        () => wouldExceedMaxOptions(options) || wouldExceedMaxEdges(options),
        [options],
    );
    const canAdd = Boolean(trimmed) && nameIsUnique && !atMax && !disabled;

    const childTrimmed = childDraftName.trim();
    const childNameIsUnique = useMemo(() => isNameUnique(options, childTrimmed), [options, childTrimmed]);
    const childIsDuplicate = Boolean(childTrimmed) && !childNameIsUnique;
    const canAddChild = Boolean(childTrimmed) && childNameIsUnique && !atMax && !disabled && childDraft !== null;

    const commitTopLevel = useCallback(() => {
        const name = draftName.trim();
        if (!name || !isNameUnique(options, name) || wouldExceedMaxOptions(options) || wouldExceedMaxEdges(options) || disabled) {
            return;
        }
        onOptionsChange(addTopLevelOption(options, name));
        setDraftName('');
    }, [draftName, options, onOptionsChange, disabled]);

    const closePane = useCallback(() => {
        flushSync(() => {
            setOpenPane(null);
        });
    }, []);

    const confirmGrant = useCallback((req: GrantConfirmRequest) => {
        // Menu backdrop sits above GenericModal; close Parents before the grant dialog.
        if (req.newlyReachable.length > 0) {
            closePane();
        }
        return confirmGrantRaw(req);
    }, [closePane, confirmGrantRaw]);

    const handlePaneOptionsChange = useCallback((next: PropertyFieldOption[]) => {
        closePane();
        onOptionsChange(next);
    }, [closePane, onOptionsChange]);

    const handleGoToOrphan = useCallback((optionName: string) => {
        closePane();
        flushSync(() => {
            setCollapsedKeys((current) => expandAncestorsForOption(current, occurrences, optionName));
            setHighlightedOptionName(optionName);
        });
        focusGraphRow(optionName, occurrences, rowRefs.current);

        // GenericModal restoreFocus runs after onExited and would steal focus back to Delete.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => focusGraphRow(optionName, occurrences, rowRefs.current));
        });

        if (highlightTimeoutRef.current !== null) {
            window.clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = window.setTimeout(() => {
            setHighlightedOptionName(null);
            highlightTimeoutRef.current = null;
        }, ROW_HIGHLIGHT_TIMEOUT_MS);
    }, [closePane, occurrences]);

    const promptDelete = useGraphNodeDelete(options, onOptionsChange, handleGoToOrphan);

    const handleExpandOccurrence = useCallback((key: string) => {
        setCollapsedKeys((current) => {
            if (!current.has(key)) {
                return current;
            }
            const next = new Set(current);
            next.delete(key);
            return next;
        });
    }, []);

    const handleOpenMenuAddChild = useCallback((occurrence: GraphOccurrence, index: number) => {
        setChildDraft({
            parentName: occurrence.option.name,
            insertAfterIndex: subtreeInsertAfterIndex(occurrences, occurrence, index),
            depth: occurrence.depth + 1,
        });
        setChildDraftName('');
        setOpenPane(null);
        handleExpandOccurrence(occurrence.key);
    }, [handleExpandOccurrence, occurrences]);

    const handleToggleCollapse = useCallback((key: string) => {
        setCollapsedKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    const handleOpenMenu = useCallback((key: string, view: GraphPaneView) => {
        setOpenPane({key, view});
        setChildDraft(null);
    }, []);

    const handleCloseMenu = useCallback(() => {
        setOpenPane(null);
    }, []);

    const handleRename = useCallback((currentName: string, nextName: string): 'applied' | 'duplicate' | 'noop' => {
        const trimmed = nextName.trim();
        if (trimmed === '' || trimmed === currentName) {
            return 'noop';
        }
        if (!isNameUnique(options, trimmed, currentName)) {
            return 'duplicate';
        }
        onOptionsChange(renameOption(options, currentName, trimmed));
        setOpenPane((current) => {
            if (!current) {
                return current;
            }
            return {
                ...current,
                key: remapOccurrenceKey(current.key, currentName, trimmed),
            };
        });
        setCollapsedKeys((current) => {
            const next = new Set<string>();
            for (const key of current) {
                next.add(remapOccurrenceKey(key, currentName, trimmed));
            }
            return next;
        });
        setChildDraft((current) => {
            if (!current || current.parentName !== currentName) {
                return current;
            }
            return {...current, parentName: trimmed};
        });
        return 'applied';
    }, [onOptionsChange, options]);

    const commitChild = useCallback(() => {
        if (!childDraft) {
            return;
        }
        const name = childDraftName.trim();
        if (!name || !isNameUnique(options, name) || atMax || disabled) {
            return;
        }
        onOptionsChange(addChildOption(options, name, childDraft.parentName));
        setChildDraft(null);
        setChildDraftName('');
    }, [atMax, childDraft, childDraftName, disabled, onOptionsChange, options]);

    const cancelChild = useCallback(() => {
        setChildDraft(null);
        setChildDraftName('');
    }, []);

    const addForm = (
        <AddTopLevelForm
            isEmptyCanvas={options.length === 0}
            draftName={draftName}
            onDraftNameChange={setDraftName}
            isDuplicate={isDuplicate}
            trimmed={trimmed}
            atMax={atMax}
            canAdd={canAdd}
            disabled={disabled}
            onCommit={commitTopLevel}
        />
    );

    const listItems: React.ReactNode[] = [];
    occurrences.forEach((occurrence, rowIndex) => {
        if (isHiddenByCollapsedAncestor(occurrencePath(occurrence), collapsedKeys)) {
            return;
        }
        listItems.push(
            <GraphRow
                key={occurrence.key}
                occurrence={occurrence}
                index={rowIndex}
                disabled={disabled}
                atMax={atMax}
                menuOpen={openPane?.key === occurrence.key}
                menuInitialView={openPane?.view ?? 'main'}
                expanded={!collapsedKeys.has(occurrence.key)}
                onToggleCollapse={handleToggleCollapse}
                onOpenMenuAddChild={handleOpenMenuAddChild}
                onOpenMenu={handleOpenMenu}
                onCloseMenu={handleCloseMenu}
                onRename={handleRename}
                onExpandOccurrence={handleExpandOccurrence}
                onDelete={promptDelete}
                options={options}
                onOptionsChange={onOptionsChange}
                onPaneOptionsChange={handlePaneOptionsChange}
                confirmGrant={confirmGrant}
                onDropResult={handleDropResult}
                highlighted={occurrence.option.name === highlightedOptionName}
                rowRefs={rowRefs}
                parentName={parentNameOf(occurrence, graphIndex)}
            />,
        );
        if (childDraft && childDraft.insertAfterIndex === rowIndex) {
            listItems.push(
                <ChildDraftRow
                    key='attribute-options-graph-child-draft'
                    depth={childDraft.depth}
                    parentName={childDraft.parentName}
                    draftName={childDraftName}
                    onDraftNameChange={setChildDraftName}
                    isDuplicate={childIsDuplicate}
                    trimmed={childTrimmed}
                    canAdd={canAddChild}
                    disabled={disabled}
                    atMax={atMax}
                    onCommit={commitChild}
                    onCancel={cancelChild}
                />,
            );
        }
    });

    return (
        <div
            className='attribute-options-graph-values'
            data-testid='attributeOptionsGraphValues'
        >
            <p className='attribute-options-graph-values__helper'>
                <FormattedMessage {...messages.helper}/>
            </p>
            {dropAlert && (
                <GraphParentEdgeAlert
                    result={dropAlert.check}
                    childName={dropAlert.childName}
                    parentName={dropAlert.parentName}
                    className='attribute-options-graph-values__drop-alert'
                    testId='attributeOptionsGraphValues__dropAlert'
                />
            )}
            {options.length === 0 ? (
                <div
                    className='attribute-options-graph-values__empty-canvas'
                    data-testid='attributeOptionsGraphEmpty'
                >
                    <div
                        className='attribute-options-graph-values__empty-icon'
                        aria-hidden={true}
                    >
                        <SitemapIcon size={48}/>
                    </div>
                    <h3 className='attribute-options-graph-values__empty-heading'>
                        <FormattedMessage {...messages.emptyHeading}/>
                    </h3>
                    <p className='attribute-options-graph-values__empty-body'>
                        <FormattedMessage {...messages.emptyBody}/>
                    </p>
                    {addForm}
                </div>
            ) : (
                <>
                    <ul
                        className='attribute-options-graph-values__list'
                        data-testid='attributeOptionsGraphList'
                    >
                        {listItems}
                    </ul>
                    {addForm}
                </>
            )}
            <p className='attribute-options-graph-values__footer'>
                <FormattedMessage {...messages.footer}/>
            </p>
        </div>
    );
};

export default AttributeOptionsGraphValues;

const messages = defineMessages({
    helper: {
        id: 'admin.global_attributes.attribute_details.options.graph.helper',
        defaultMessage: 'Each value can have parents and children.',
    },
    emptyHeading: {
        id: 'admin.global_attributes.attribute_details.options.graph.empty.heading',
        defaultMessage: 'Add the first value',
    },
    emptyBody: {
        id: 'admin.global_attributes.attribute_details.options.graph.empty.body',
        defaultMessage: 'Start with a top-level value. You can add parents and children from its row.',
    },
    footer: {
        id: 'admin.global_attributes.attribute_details.options.graph.footer',
        defaultMessage: 'Up to 100 parents per value, 100 levels deep.',
    },
});
