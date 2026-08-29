// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/border';
import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {
    ChevronDownIcon,
    ChevronRightIcon,
    DragVerticalIcon,
    LinkVariantIcon,
    PlusIcon,
    SitemapIcon,
    TrashCanOutlineIcon,
} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';

import Constants from 'utils/constants';

import {useGraphNodeDelete} from './attribute_graph_delete_modal';
import {useGrantConfirm} from './attribute_graph_grant_confirm_modal';
import AttributeGraphParentsPane from './attribute_graph_parents_pane';
import type {ConfirmGrant, ProposeParentResult} from './graph_parent_ops';
import {
    addChildOption,
    addTopLevelOption,
    cycleErrorValues,
    depthErrorValues,
    getChildren,
    getRoots,
    isNameUnique,
    oxfordJoinNames,
    renameOption,
    wouldExceedMaxEdges,
    wouldExceedMaxOptions,
    type CheckParentEdgeResult,
} from './graph_utils';
import {dropAlertFromProposeResult, useGraphRowDnd, type GraphDropAlert} from './use_graph_dnd';

import './attribute_options_graph_values.scss';

type Props = {
    options: PropertyFieldOption[];
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    disabled?: boolean;
};

type GraphOccurrence = {
    option: PropertyFieldOption;
    parentName: string | null;
    depth: number;
    path: string[];
    occurrenceKey: string;
};

type ChildDraft = {
    parentName: string;
    insertAfterIndex: number;
    depth: number;
};

type AddTopLevelFormProps = {
    testIdPrefix: 'attributeOptionsGraphEmpty' | 'attributeOptionsGraphAddTop';
    draftName: string;
    onDraftNameChange: (value: string) => void;
    isDuplicate: boolean;
    trimmed: string;
    atMax: boolean;
    canAdd: boolean;
    disabled: boolean;
    onCommit: () => void;
};

type GraphPaneView = 'main' | 'parents' | 'children';

type GraphRowProps = {
    occurrence: GraphOccurrence;
    index: number;
    disabled: boolean;
    atMax: boolean;
    menuOpen: boolean;
    menuInitialView: GraphPaneView;
    expanded: boolean;
    onToggleCollapse: (occurrenceKey: string) => void;
    onOpenMenuAddChild: (occurrence: GraphOccurrence) => void;
    onOpenMenu: (occurrenceKey: string, view: GraphPaneView) => void;
    onCloseMenu: () => void;
    onRename: (currentName: string, nextName: string) => 'applied' | 'duplicate' | 'noop';
    onExpandOccurrence: (occurrenceKey: string) => void;
    onDelete: (optionName: string) => void;
    options: PropertyFieldOption[];
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    confirmGrant?: ConfirmGrant;
    onDropResult: (result: ProposeParentResult, names: {childName: string; parentName: string}) => void;
};

const DROP_ALERT_TIMEOUT_MS = 4000;

type ChildDraftRowProps = {
    depth: number;
    parentName: string;
    draftName: string;
    onDraftNameChange: (value: string) => void;
    isDuplicate: boolean;
    trimmed: string;
    canAdd: boolean;
    disabled: boolean;
    atMax: boolean;
    onCommit: () => void;
    onCancel: () => void;
};

function flattenOccurrences(options: PropertyFieldOption[]): GraphOccurrence[] {
    const occurrences: GraphOccurrence[] = [];

    const walk = (option: PropertyFieldOption, path: string[]) => {
        occurrences.push({
            option,
            parentName: path.length === 1 ? null : path[path.length - 2],
            depth: path.length - 1,
            path,
            occurrenceKey: path.join('\0'),
        });
        for (const child of getChildren(options, option.name)) {
            if (path.includes(child.name)) {
                continue;
            }
            walk(child, [...path, child.name]);
        }
    };

    for (const root of getRoots(options)) {
        walk(root, [root.name]);
    }

    return occurrences;
}

function pathStartsWith(path: string[], prefix: string[]): boolean {
    if (path.length < prefix.length) {
        return false;
    }
    return prefix.every((name, i) => path[i] === name);
}

function isHiddenByCollapsedAncestor(path: string[], collapsedKeys: Set<string>): boolean {
    for (let i = 1; i < path.length; i++) {
        if (collapsedKeys.has(path.slice(0, i).join('\0'))) {
            return true;
        }
    }
    return false;
}

function occurrenceHasChildren(options: PropertyFieldOption[], occurrence: GraphOccurrence): boolean {
    return getChildren(options, occurrence.option.name).some((child) => !occurrence.path.includes(child.name));
}

function remapOccurrenceKey(key: string, oldName: string, newName: string): string {
    return key.split('\0').map((part) => (part === oldName ? newName : part)).join('\0');
}

function subtreeInsertAfterIndex(occurrences: GraphOccurrence[], occurrence: GraphOccurrence, index: number): number {
    let insertAfterIndex = index;
    for (let j = index; j < occurrences.length; j++) {
        if (pathStartsWith(occurrences[j].path, occurrence.path)) {
            insertAfterIndex = j;
        } else if (j > index) {
            break;
        }
    }
    return insertAfterIndex;
}

const AddTopLevelForm = ({
    testIdPrefix,
    draftName,
    onDraftNameChange,
    isDuplicate,
    trimmed,
    atMax,
    canAdd,
    disabled,
    onCommit,
}: AddTopLevelFormProps) => {
    const {formatMessage} = useIntl();
    const isEmptyCanvas = testIdPrefix === 'attributeOptionsGraphEmpty';
    const placeholder = formatMessage(isEmptyCanvas ? messages.namePlaceholder : messages.addTopLevel);

    return (
        <div className={isEmptyCanvas ? 'attribute-options-graph-values__empty-form' : 'attribute-options-graph-values__add-top'}>
            <Input
                name={isEmptyCanvas ? 'graph_empty_option_name' : 'graph_add_top_option_name'}
                type='text'
                useLegend={false}
                label={placeholder}
                placeholder={placeholder}
                aria-label={formatMessage(messages.addTopLevel)}
                value={draftName}
                onChange={(e) => onDraftNameChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (canAdd) {
                            onCommit();
                        }
                    }
                }}
                disabled={disabled || atMax}
                maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                hasError={isDuplicate}
                customMessage={isDuplicate ?
                    {type: 'error', value: formatMessage(messages.duplicateName, {name: trimmed})} :
                    null}
                data-testid={`${testIdPrefix}__nameInput`}
            />
            <Button
                type='button'
                emphasis={isEmptyCanvas ? 'primary' : 'secondary'}
                onClick={onCommit}
                disabled={!canAdd}
                data-testid={`${testIdPrefix}__addButton`}
            >
                <PlusIcon size={16}/>
                <FormattedMessage {...messages.addValue}/>
            </Button>
        </div>
    );
};

function ChildDraftRow({
    depth,
    parentName,
    draftName,
    onDraftNameChange,
    isDuplicate,
    trimmed,
    canAdd,
    disabled,
    atMax,
    onCommit,
    onCancel,
}: ChildDraftRowProps) {
    const {formatMessage} = useIntl();
    const childNamePlaceholder = formatMessage(messages.childNamePlaceholder);

    return (
        <li
            className='attribute-options-graph-values__row attribute-options-graph-values__row--draft'
            style={{['--attribute-options-graph-values-indent' as string]: depth}}
            data-testid='attributeOptionsGraphRow__childDraft'
            data-depth={String(depth)}
        >
            <span
                className='attribute-options-graph-values__gutter'
                aria-hidden={true}
            >
                <span className='attribute-options-graph-values__collapse-spacer'/>
                <span className='attribute-options-graph-values__draft-handle-spacer'/>
            </span>
            <Input
                name='graph_child_option_name'
                type='text'
                useLegend={false}
                label={childNamePlaceholder}
                placeholder={childNamePlaceholder}
                aria-label={formatMessage(messages.childNameAria, {name: parentName})}
                value={draftName}
                onChange={(e) => onDraftNameChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        onCancel();
                        return;
                    }
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (canAdd) {
                            onCommit();
                        }
                    }
                }}
                disabled={disabled || atMax}
                maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                hasError={isDuplicate}
                customMessage={isDuplicate ?
                    {type: 'error', value: formatMessage(messages.duplicateName, {name: trimmed})} :
                    null}
                data-testid='attributeOptionsGraphRow__childNameInput'
                autoFocus={true}
            />
            <Button
                type='button'
                emphasis='secondary'
                size='sm'
                onClick={onCommit}
                disabled={!canAdd}
                data-testid='attributeOptionsGraphRow__childAddButton'
            >
                <FormattedMessage {...messages.add}/>
            </Button>
            <Button
                type='button'
                emphasis='tertiary'
                size='sm'
                onClick={onCancel}
                data-testid='attributeOptionsGraphRow__childCancelButton'
            >
                <FormattedMessage {...messages.cancel}/>
            </Button>
        </li>
    );
}

const GraphRow = React.memo(({
    occurrence,
    index,
    disabled,
    atMax,
    menuOpen,
    menuInitialView,
    expanded,
    onToggleCollapse,
    onOpenMenuAddChild,
    onOpenMenu,
    onCloseMenu,
    onRename,
    onExpandOccurrence,
    onDelete,
    options,
    onOptionsChange,
    confirmGrant,
    onDropResult,
}: GraphRowProps) => {
    const {formatMessage} = useIntl();
    const editValueLabel = formatMessage(messages.editValue, {name: occurrence.option.name});
    const addChildLabel = formatMessage(messages.addChildAria, {name: occurrence.option.name});
    const parentNames = occurrence.option.parents ?? [];
    const parentCount = parentNames.length;
    const hasChildren = occurrenceHasChildren(options, occurrence);
    const [rowElement, setRowElement] = useState<HTMLLIElement | null>(null);
    const [handleElement, setHandleElement] = useState<HTMLSpanElement | null>(null);

    const {isOver} = useGraphRowDnd({
        rowElement,
        handleElement,
        optionName: occurrence.option.name,
        parentName: occurrence.parentName,
        options,
        onOptionsChange,
        confirmGrant,
        disabled,
        onDropResult,
    });

    const toggleMenu = (view: GraphPaneView) => {
        if (menuOpen && menuInitialView === view) {
            onCloseMenu();
            return;
        }
        onOpenMenu(occurrence.occurrenceKey, view);
    };

    const parentsBadge = parentCount >= 2 && (
        <button
            type='button'
            className={classNames('attribute-options-graph-values__parents-badge', {
                'attribute-options-graph-values__parents-badge--static': disabled,
            })}
            onClick={() => toggleMenu('parents')}
            disabled={disabled}
            data-testid='attributeOptionsGraphRow__parentsBadge'
        >
            <LinkVariantIcon
                size={12}
                aria-hidden={true}
            />
            <FormattedMessage
                {...messages.parentsBadge}
                values={{n: parentCount}}
            />
        </button>
    );

    return (
        <li
            ref={setRowElement}
            className={classNames('attribute-options-graph-values__row', {
                'attribute-options-graph-values__row--active': menuOpen,
            })}
            style={{['--attribute-options-graph-values-indent' as string]: occurrence.depth}}
            data-testid='attributeOptionsGraphRow'
            data-option-name={occurrence.option.name}
            data-parent-name={occurrence.parentName ?? ''}
            data-depth={String(occurrence.depth)}
            aria-expanded={hasChildren ? expanded : undefined}
            tabIndex={-1}
        >
            <span className='attribute-options-graph-values__gutter'>
                {hasChildren ? (
                    <button
                        type='button'
                        className='attribute-options-graph-values__collapse'
                        aria-label={formatMessage(expanded ? messages.collapse : messages.expand, {name: occurrence.option.name})}
                        aria-expanded={expanded}
                        onClick={() => onToggleCollapse(occurrence.occurrenceKey)}
                        data-testid='attributeOptionsGraphRow__collapse'
                    >
                        {expanded ? <ChevronDownIcon size={16}/> : <ChevronRightIcon size={16}/>}
                    </button>
                ) : (
                    <span
                        className='attribute-options-graph-values__collapse-spacer'
                        aria-hidden={true}
                    />
                )}
                <span
                    ref={setHandleElement}
                    className={classNames('attribute-options-graph-values__drag-handle', {
                        'attribute-options-graph-values__drag-handle--disabled': disabled,
                    })}
                    tabIndex={-1}
                    aria-hidden={true}
                    data-testid='attributeOptionsGraphRow__dragHandle'
                >
                    <DragVerticalIcon size={16}/>
                </span>
            </span>

            {disabled ? (
                <span
                    className='attribute-options-graph-values__name attribute-options-graph-values__name--static'
                    data-testid='attributeOptionsGraphRow__name'
                >
                    {occurrence.option.name}
                </span>
            ) : (
                <button
                    type='button'
                    className='attribute-options-graph-values__name'
                    onClick={() => toggleMenu('main')}
                    data-testid='attributeOptionsGraphRow__name'
                >
                    {occurrence.option.name}
                </button>
            )}

            {parentsBadge && (disabled ? parentsBadge : (
                <WithTooltip
                    title={formatMessage(messages.parentsBadgeTooltip, {names: oxfordJoinNames(parentNames)})}
                >
                    {parentsBadge}
                </WithTooltip>
            ))}

            <span className='attribute-options-graph-values__spacer'/>

            {!disabled && (
                <div className='attribute-options-graph-values__actions'>
                    <WithTooltip title={addChildLabel}>
                        <button
                            type='button'
                            className='btn btn-icon btn-xs attribute-options-graph-values__action'
                            aria-label={addChildLabel}
                            disabled={atMax}
                            onClick={() => onOpenMenuAddChild(occurrence)}
                            data-testid='attributeOptionsGraphRow__addChild'
                        >
                            <PlusIcon size={16}/>
                        </button>
                    </WithTooltip>
                    <WithTooltip title={formatMessage(messages.parentsActionTooltip)}>
                        <button
                            type='button'
                            className='btn btn-icon btn-xs attribute-options-graph-values__action'
                            aria-label={formatMessage(messages.parentsAria, {name: occurrence.option.name})}
                            onClick={() => toggleMenu('parents')}
                            data-testid='attributeOptionsGraphRow__parents'
                        >
                            <SitemapIcon size={16}/>
                        </button>
                    </WithTooltip>
                    <WithTooltip title={formatMessage(messages.deleteThisValue)}>
                        <button
                            type='button'
                            className='btn btn-icon btn-xs attribute-options-graph-values__action attribute-options-graph-values__action--danger'
                            aria-label={formatMessage(messages.deleteAria, {name: occurrence.option.name})}
                            onClick={() => onDelete(occurrence.option.name)}
                            data-testid='attributeOptionsGraphRow__delete'
                        >
                            <TrashCanOutlineIcon size={16}/>
                        </button>
                    </WithTooltip>
                </div>
            )}

            {menuOpen && (
                <Menu.Container
                    menuButton={{
                        id: `attribute-options-graph-row-parents-${index}`,
                        as: 'div',
                        class: 'attribute-options-graph-values__parents-anchor',
                        'aria-label': editValueLabel,
                        dataTestId: 'attributeOptionsGraphRow__parentsAnchor',
                        children: <span className='sr-only'>{editValueLabel}</span>,
                    }}
                    menu={{
                        id: `attribute-options-graph-row-parents-menu-${index}`,
                        className: 'attribute-graph-parents-pane',
                        width: '368px',
                        'aria-label': editValueLabel,
                        isMenuOpen: true,
                        onToggle: (open) => {
                            if (!open) {
                                onCloseMenu();
                            }
                        },
                    }}
                    anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                    transformOrigin={{vertical: 'top', horizontal: 'right'}}
                >
                    <AttributeGraphParentsPane
                        key={`${occurrence.occurrenceKey}:${menuInitialView}`}
                        options={options}
                        optionName={occurrence.option.name}
                        onOptionsChange={onOptionsChange}
                        onDelete={onDelete}
                        onRename={onRename}
                        onChildAdded={() => onExpandOccurrence(occurrence.occurrenceKey)}
                        disabled={disabled}
                        atMax={atMax}
                        confirmGrant={confirmGrant}
                        initialView={menuInitialView}
                    />
                </Menu.Container>
            )}
            {isOver && (
                <DropIndicator/>
            )}
        </li>
    );
});

function dropAlertMessage(check: Extract<CheckParentEdgeResult, {ok: false}>) {
    switch (check.error) {
    case 'cycle':
        return messages.cycleError;
    case 'depth':
        return messages.depthError;
    case 'max-parents':
        return messages.maxParentsError;
    case 'self':
        return messages.cycleError;
    default: {
        const exhaustive: never = check;
        return exhaustive;
    }
    }
}

function dropAlertValues(alert: GraphDropAlert): Record<string, string | number> {
    switch (alert.check.error) {
    case 'cycle':
        return cycleErrorValues(alert.parentName, alert.childName);
    case 'depth':
        return depthErrorValues(alert.childName, alert.check.depth);
    case 'max-parents':
        return {};
    case 'self':
        return {};
    default: {
        const exhaustive: never = alert.check;
        return exhaustive;
    }
    }
}

const AttributeOptionsGraphValues = ({options, onOptionsChange, disabled = false}: Props) => {
    const confirmGrant = useGrantConfirm();
    const [draftName, setDraftName] = useState('');
    const [openPane, setOpenPane] = useState<{occurrenceKey: string; view: GraphPaneView} | null>(null);
    const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => new Set());
    const [childDraft, setChildDraft] = useState<ChildDraft | null>(null);
    const [childDraftName, setChildDraftName] = useState('');
    const [dropAlert, setDropAlert] = useState<GraphDropAlert | null>(null);
    const dropAlertTimeoutRef = useRef<number | null>(null);

    const clearDropAlert = useCallback(() => {
        if (dropAlertTimeoutRef.current !== null) {
            window.clearTimeout(dropAlertTimeoutRef.current);
            dropAlertTimeoutRef.current = null;
        }
        setDropAlert(null);
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
        };
    }, [clearDropAlert]);

    const occurrences = useMemo(() => flattenOccurrences(options), [options]);

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

    const handleGoToOrphan = useCallback((optionName: string) => {
        // Close overlays first; focusing on confirm loses to GenericModal restoreFocus.
        flushSync(() => {
            setOpenPane(null);
        });
        const el = document.querySelector(
            `[data-testid="attributeOptionsGraphRow"][data-option-name="${CSS.escape(optionName)}"]`,
        );
        if (!(el instanceof HTMLElement)) {
            return;
        }
        el.scrollIntoView({block: 'nearest'});
        el.focus();
    }, []);

    const promptDelete = useGraphNodeDelete(options, onOptionsChange, handleGoToOrphan);

    const handleExpandOccurrence = useCallback((occurrenceKey: string) => {
        setCollapsedKeys((current) => {
            if (!current.has(occurrenceKey)) {
                return current;
            }
            const next = new Set(current);
            next.delete(occurrenceKey);
            return next;
        });
    }, []);

    const handleOpenMenuAddChild = useCallback((occurrence: GraphOccurrence) => {
        const nextOccurrences = flattenOccurrences(options);
        const i = nextOccurrences.findIndex((item) => item.occurrenceKey === occurrence.occurrenceKey);
        if (i < 0) {
            return;
        }
        setChildDraft({
            parentName: occurrence.option.name,
            insertAfterIndex: subtreeInsertAfterIndex(nextOccurrences, occurrence, i),
            depth: occurrence.depth + 1,
        });
        setChildDraftName('');
        setOpenPane(null);
        handleExpandOccurrence(occurrence.occurrenceKey);
    }, [handleExpandOccurrence, options]);

    const handleToggleCollapse = useCallback((occurrenceKey: string) => {
        setCollapsedKeys((current) => {
            const next = new Set(current);
            if (next.has(occurrenceKey)) {
                next.delete(occurrenceKey);
            } else {
                next.add(occurrenceKey);
            }
            return next;
        });
    }, []);

    const handleOpenMenu = useCallback((occurrenceKey: string, view: GraphPaneView) => {
        setOpenPane({occurrenceKey, view});
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
                occurrenceKey: remapOccurrenceKey(current.occurrenceKey, currentName, trimmed),
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
            testIdPrefix={options.length === 0 ? 'attributeOptionsGraphEmpty' : 'attributeOptionsGraphAddTop'}
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
    occurrences.forEach((occurrence, index) => {
        if (isHiddenByCollapsedAncestor(occurrence.path, collapsedKeys)) {
            return;
        }
        listItems.push(
            <GraphRow
                key={occurrence.occurrenceKey}
                occurrence={occurrence}
                index={index}
                disabled={disabled}
                atMax={atMax}
                menuOpen={openPane?.occurrenceKey === occurrence.occurrenceKey}
                menuInitialView={openPane?.view ?? 'main'}
                expanded={!collapsedKeys.has(occurrence.occurrenceKey)}
                onToggleCollapse={handleToggleCollapse}
                onOpenMenuAddChild={handleOpenMenuAddChild}
                onOpenMenu={handleOpenMenu}
                onCloseMenu={handleCloseMenu}
                onRename={handleRename}
                onExpandOccurrence={handleExpandOccurrence}
                onDelete={promptDelete}
                options={options}
                onOptionsChange={onOptionsChange}
                confirmGrant={confirmGrant}
                onDropResult={handleDropResult}
            />,
        );
        if (childDraft && childDraft.insertAfterIndex === index) {
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
            {dropAlert && dropAlert.check.error !== 'self' && (
                <div
                    className='attribute-options-graph-values__drop-alert'
                    role='alert'
                    data-testid='attributeOptionsGraphValues__dropAlert'
                >
                    <FormattedMessage
                        {...dropAlertMessage(dropAlert.check)}
                        values={dropAlertValues(dropAlert)}
                    />
                </div>
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
    namePlaceholder: {
        id: 'admin.global_attributes.attribute_details.options.graph.name_placeholder',
        defaultMessage: 'Value name',
    },
    childNamePlaceholder: {
        id: 'admin.global_attributes.attribute_details.options.graph.child_name_placeholder',
        defaultMessage: 'Name the new value',
    },
    childNameAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.child_name_aria',
        defaultMessage: 'New value granted by {name}',
    },
    add: {
        id: 'admin.global_attributes.attribute_details.options.graph.add',
        defaultMessage: 'Add',
    },
    addValue: {
        id: 'admin.global_attributes.attribute_details.options.graph.add_value',
        defaultMessage: 'Add value',
    },
    cancel: {
        id: 'admin.global_attributes.attribute_details.options.graph.cancel',
        defaultMessage: 'Cancel',
    },
    addTopLevel: {
        id: 'admin.global_attributes.attribute_details.options.graph.add_top_level',
        defaultMessage: 'Add a top-level value',
    },
    footer: {
        id: 'admin.global_attributes.attribute_details.options.graph.footer',
        defaultMessage: 'Up to 100 parents per value, 100 levels deep.',
    },
    duplicateName: {
        id: 'admin.global_attributes.attribute_details.options.graph.duplicate_name',
        defaultMessage: '"{name}" already exists in this field.',
    },
    parentsBadge: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_badge',
        defaultMessage: '{n} parents',
    },
    addChildAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.add_child_aria',
        defaultMessage: 'Add a value under {name}',
    },
    editValue: {
        id: 'admin.global_attributes.attribute_details.options.graph.edit_value',
        defaultMessage: 'Edit {name}',
    },
    parentsAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_aria',
        defaultMessage: 'Parents of {name}',
    },
    parentsActionTooltip: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_action_tooltip',
        defaultMessage: 'Parents — who this value is granted by',
    },
    parentsBadgeTooltip: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_badge_tooltip',
        defaultMessage: 'Under {names}',
    },
    collapse: {
        id: 'admin.global_attributes.attribute_details.options.graph.collapse',
        defaultMessage: 'Collapse {name}',
    },
    expand: {
        id: 'admin.global_attributes.attribute_details.options.graph.expand',
        defaultMessage: 'Expand {name}',
    },
    deleteAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.delete_aria',
        defaultMessage: 'Delete {name}',
    },
    deleteThisValue: {
        id: 'admin.global_attributes.attribute_details.options.graph.delete_this_value',
        defaultMessage: 'Delete this value',
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
});
