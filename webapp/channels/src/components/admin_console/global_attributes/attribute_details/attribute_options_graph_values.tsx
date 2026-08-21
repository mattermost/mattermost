// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/border';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {DotsVerticalIcon, DragVerticalIcon, PlusIcon, SitemapIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';
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
    renameOption,
    wouldExceedMaxEdges,
    wouldExceedMaxOptions,
    type CheckParentEdgeResult,
} from './graph_utils';
import {dropAlertFromProposeResult, useGraphRowDnd} from './use_graph_dnd';

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

type GraphRowProps = {
    occurrence: GraphOccurrence;
    index: number;
    disabled: boolean;
    atMax: boolean;
    isRenaming: boolean;
    renameDraft: string;
    renameIsDuplicate: boolean;
    parentsOpen: boolean;
    menuOpen: boolean;
    onOpenMenuAddChild: (occurrence: GraphOccurrence) => void;
    onOpenMenu: (occurrenceKey: string) => void;
    onCloseMenu: (occurrenceKey: string) => void;
    onOpenParents: (occurrenceKey: string) => void;
    onCloseParents: () => void;
    onStartRename: (occurrenceKey: string, currentName: string) => void;
    onRenameDraftChange: (value: string) => void;
    onCommitRename: () => void;
    onCancelRename: () => void;
    onDelete: (optionName: string) => void;
    options: PropertyFieldOption[];
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    confirmGrant?: ConfirmGrant;
    onDropResult: (result: ProposeParentResult, names: {childName: string; parentName: string}) => void;
};

type DropAlert = {
    check: Extract<CheckParentEdgeResult, {ok: false}>;
    childName: string;
    parentName: string;
};

const DROP_ALERT_TIMEOUT_MS = 4000;

type ChildDraftRowProps = {
    depth: number;
    draftName: string;
    onDraftNameChange: (value: string) => void;
    isDuplicate: boolean;
    trimmed: string;
    canAdd: boolean;
    disabled: boolean;
    atMax: boolean;
    onCommit: () => void;
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

    return (
        <div className={isEmptyCanvas ? 'attribute-options-graph-values__empty-form' : 'attribute-options-graph-values__add-top'}>
            <Input
                name={isEmptyCanvas ? 'graph_empty_option_name' : 'graph_add_top_option_name'}
                type='text'
                useLegend={false}
                placeholder={formatMessage(messages.namePlaceholder)}
                aria-label={isEmptyCanvas ? undefined : formatMessage(messages.addTopLevel)}
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
                emphasis='primary'
                onClick={onCommit}
                disabled={!canAdd}
                aria-label={isEmptyCanvas ? undefined : formatMessage(messages.addTopLevel)}
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
    draftName,
    onDraftNameChange,
    isDuplicate,
    trimmed,
    canAdd,
    disabled,
    atMax,
    onCommit,
}: ChildDraftRowProps) {
    const {formatMessage} = useIntl();

    return (
        <li
            className='attribute-options-graph-values__row attribute-options-graph-values__row--draft'
            style={{['--attribute-options-graph-values-indent' as string]: depth}}
            data-testid='attributeOptionsGraphRow__childDraft'
        >
            <Input
                name='graph_child_option_name'
                type='text'
                useLegend={false}
                placeholder={formatMessage(messages.namePlaceholder)}
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
                data-testid='attributeOptionsGraphRow__childNameInput'
                autoFocus={true}
            />
            <Button
                type='button'
                emphasis='primary'
                onClick={onCommit}
                disabled={!canAdd}
                data-testid='attributeOptionsGraphRow__childAddButton'
            >
                <PlusIcon size={16}/>
                <FormattedMessage {...messages.addValue}/>
            </Button>
        </li>
    );
}

const GraphRow = React.memo(({
    occurrence,
    index,
    disabled,
    atMax,
    isRenaming,
    renameDraft,
    renameIsDuplicate,
    parentsOpen,
    menuOpen,
    onOpenMenuAddChild,
    onOpenMenu,
    onCloseMenu,
    onOpenParents,
    onCloseParents,
    onStartRename,
    onRenameDraftChange,
    onCommitRename,
    onCancelRename,
    onDelete,
    options,
    onOptionsChange,
    confirmGrant,
    onDropResult,
}: GraphRowProps) => {
    const {formatMessage} = useIntl();
    const skipBlurCommitRef = useRef(false);
    const parentCount = (occurrence.option.parents ?? []).length;
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

    return (
        <li
            ref={setRowElement}
            className='attribute-options-graph-values__row'
            style={{['--attribute-options-graph-values-indent' as string]: occurrence.depth}}
            data-testid='attributeOptionsGraphRow'
            data-option-name={occurrence.option.name}
            data-parent-name={occurrence.parentName ?? ''}
            data-depth={String(occurrence.depth)}
            tabIndex={-1}
        >
            <span
                ref={setHandleElement}
                className={'attribute-options-graph-values__drag-handle' + (disabled ? ' attribute-options-graph-values__drag-handle--disabled' : '')}
                tabIndex={-1}
                aria-hidden={true}
                data-testid='attributeOptionsGraphRow__dragHandle'
            >
                <DragVerticalIcon size={18}/>
            </span>

            {isRenaming ? (
                <Input
                    name={`graph_rename_${index}`}
                    type='text'
                    useLegend={false}
                    value={renameDraft}
                    onChange={(e) => onRenameDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            skipBlurCommitRef.current = true;
                            onCancelRename();
                            return;
                        }
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            skipBlurCommitRef.current = true;
                            onCommitRename();
                        }
                    }}
                    onBlur={() => {
                        if (skipBlurCommitRef.current) {
                            skipBlurCommitRef.current = false;
                            return;
                        }
                        onCommitRename();
                    }}
                    disabled={disabled}
                    maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                    hasError={renameIsDuplicate}
                    customMessage={renameIsDuplicate ?
                        {type: 'error', value: formatMessage(messages.duplicateName, {name: renameDraft.trim()})} :
                        null}
                    data-testid='attributeOptionsGraphRow__renameInput'
                    autoFocus={true}
                />
            ) : (
                <span
                    className='attribute-options-graph-values__name'
                    data-testid='attributeOptionsGraphRow__name'
                >
                    {occurrence.option.name}
                </span>
            )}

            {parentCount >= 2 && (
                <span
                    className='attribute-options-graph-values__parents-badge'
                    data-testid='attributeOptionsGraphRow__parentsBadge'
                >
                    <FormattedMessage
                        {...messages.parentsBadge}
                        values={{n: parentCount}}
                    />
                </span>
            )}

            <Menu.Container
                menuButton={{
                    id: `attribute-options-graph-row-menu-${index}`,
                    class: 'btn btn-transparent attribute-options-graph-values__menu-button',
                    'aria-label': formatMessage(messages.rowMenuAria),
                    dataTestId: 'attributeOptionsGraphRow__menu',
                    children: <DotsVerticalIcon size={18}/>,
                    disabled,
                    onMouseDown: () => onOpenMenu(occurrence.occurrenceKey),
                }}
                menu={{
                    id: `attribute-options-graph-row-menu-list-${index}`,
                    'aria-label': formatMessage(messages.rowMenuAria),
                    isMenuOpen: menuOpen,
                    onToggle: (open) => {
                        if (open) {
                            onOpenMenu(occurrence.occurrenceKey);
                        } else {
                            onCloseMenu(occurrence.occurrenceKey);
                        }
                    },
                }}
            >
                <Menu.Item
                    disabled={disabled || atMax}
                    onClick={() => onOpenMenuAddChild(occurrence)}
                    labels={<span><FormattedMessage {...messages.addChild}/></span>}
                />
                <Menu.Item
                    onClick={() => onOpenParents(occurrence.occurrenceKey)}
                    labels={<span><FormattedMessage {...messages.parents}/></span>}
                />
                <Menu.Item
                    disabled={disabled}
                    onClick={() => onStartRename(occurrence.occurrenceKey, occurrence.option.name)}
                    labels={<span><FormattedMessage {...messages.rename}/></span>}
                />
                <Menu.Separator/>
                <Menu.Item
                    isDestructive={true}
                    disabled={disabled}
                    onClick={() => onDelete(occurrence.option.name)}
                    labels={<span><FormattedMessage {...messages.deleteThisValue}/></span>}
                />
            </Menu.Container>

            {parentsOpen && (
                <Menu.Container
                    menuButton={{
                        id: `attribute-options-graph-row-parents-${index}`,
                        class: 'attribute-options-graph-values__parents-anchor',
                        'aria-label': formatMessage(messages.parents),
                        dataTestId: 'attributeOptionsGraphRow__parentsAnchor',
                        children: <span className='sr-only'>{formatMessage(messages.parents)}</span>,
                    }}
                    menu={{
                        id: `attribute-options-graph-row-parents-menu-${index}`,
                        className: 'attribute-graph-parents-pane',
                        width: '368px',
                        'aria-label': formatMessage(messages.parents),
                        isMenuOpen: true,
                        onToggle: (open) => {
                            if (!open) {
                                onCloseParents();
                            }
                        },
                    }}
                    anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                    transformOrigin={{vertical: 'top', horizontal: 'right'}}
                >
                    <AttributeGraphParentsPane
                        options={options}
                        optionName={occurrence.option.name}
                        onOptionsChange={onOptionsChange}
                        onDelete={onDelete}
                        disabled={disabled}
                        atMax={atMax}
                        confirmGrant={confirmGrant}
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
        return messages.cycleError; // unreachable; caller skips self
    default: {
        const exhaustive: never = check;
        return exhaustive;
    }
    }
}

function dropAlertValues(alert: DropAlert): Record<string, string | number> {
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
    const [openParentsFor, setOpenParentsFor] = useState<string | null>(null);
    const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
    const [renamingKey, setRenamingKey] = useState<string | null>(null);
    const [renameDraft, setRenameDraft] = useState('');
    const [childDraft, setChildDraft] = useState<ChildDraft | null>(null);
    const [childDraftName, setChildDraftName] = useState('');
    const [dropAlert, setDropAlert] = useState<DropAlert | null>(null);
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
        // Close overlays first so a Parents pane restoreFocus cannot steal
        // after we move to the orphan. Focus still runs from modal onExited
        // (5.2); doing it on confirm loses to GenericModal restoreFocus.
        flushSync(() => {
            setOpenParentsFor(null);
            setOpenMenuFor(null);
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
        setRenamingKey(null);
    }, [options]);

    const handleOpenMenu = useCallback((occurrenceKey: string) => {
        setOpenParentsFor(null);
        setOpenMenuFor(occurrenceKey);
    }, []);

    const handleCloseMenu = useCallback((occurrenceKey: string) => {
        setOpenMenuFor((current) => (current === occurrenceKey ? null : current));
    }, []);

    const handleOpenParents = useCallback((occurrenceKey: string) => {
        setOpenMenuFor(null);
        setOpenParentsFor(occurrenceKey);
    }, []);

    const handleCloseParents = useCallback(() => {
        setOpenParentsFor(null);
    }, []);

    const handleStartRename = useCallback((occurrenceKey: string, currentName: string) => {
        setRenamingKey(occurrenceKey);
        setRenameDraft(currentName);
        setChildDraft(null);
    }, []);

    const handleCancelRename = useCallback(() => {
        setRenamingKey(null);
        setRenameDraft('');
    }, []);

    const handleCommitRename = useCallback(() => {
        if (renamingKey === null) {
            return;
        }
        const occurrence = occurrences.find((item) => item.occurrenceKey === renamingKey);
        if (!occurrence) {
            handleCancelRename();
            return;
        }
        const currentName = occurrence.option.name;
        const nextName = renameDraft.trim();
        if (nextName === '' || nextName === currentName) {
            handleCancelRename();
            return;
        }
        if (!isNameUnique(options, nextName, currentName)) {
            return;
        }
        onOptionsChange(renameOption(options, currentName, nextName));
        handleCancelRename();
    }, [handleCancelRename, occurrences, options, onOptionsChange, renameDraft, renamingKey]);

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
        listItems.push(
            <GraphRow
                key={occurrence.occurrenceKey}
                occurrence={occurrence}
                index={index}
                disabled={disabled}
                atMax={atMax}
                isRenaming={renamingKey === occurrence.occurrenceKey}
                renameDraft={renameDraft}
                renameIsDuplicate={renamingKey === occurrence.occurrenceKey && Boolean(renameDraft.trim()) && !isNameUnique(options, renameDraft.trim(), occurrence.option.name)}
                parentsOpen={openParentsFor === occurrence.occurrenceKey}
                menuOpen={openMenuFor === occurrence.occurrenceKey}
                onOpenMenuAddChild={handleOpenMenuAddChild}
                onOpenMenu={handleOpenMenu}
                onCloseMenu={handleCloseMenu}
                onOpenParents={handleOpenParents}
                onCloseParents={handleCloseParents}
                onStartRename={handleStartRename}
                onRenameDraftChange={setRenameDraft}
                onCommitRename={handleCommitRename}
                onCancelRename={handleCancelRename}
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
                    draftName={childDraftName}
                    onDraftNameChange={setChildDraftName}
                    isDuplicate={childIsDuplicate}
                    trimmed={childTrimmed}
                    canAdd={canAddChild}
                    disabled={disabled}
                    atMax={atMax}
                    onCommit={commitChild}
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
    addValue: {
        id: 'admin.global_attributes.attribute_details.options.graph.add_value',
        defaultMessage: 'Add value',
    },
    addTopLevel: {
        id: 'admin.global_attributes.attribute_details.options.graph.add_top_level',
        defaultMessage: 'Add top-level value',
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
    rowMenuAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.row_menu',
        defaultMessage: 'Row actions',
    },
    addChild: {
        id: 'admin.global_attributes.attribute_details.options.graph.add_child',
        defaultMessage: 'Add child',
    },
    parents: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents',
        defaultMessage: 'Parents',
    },
    rename: {
        id: 'admin.global_attributes.attribute_details.options.graph.rename',
        defaultMessage: 'Rename',
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
