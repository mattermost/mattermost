// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {KeyboardEvent} from 'react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {DropResult} from 'react-beautiful-dnd';
import {DragDropContext, Draggable, Droppable} from 'react-beautiful-dnd';
import {createPortal} from 'react-dom';
import {FormattedMessage, useIntl} from 'react-intl';

import {DragVerticalIcon, PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import Constants from 'utils/constants';

import {DangerText} from './controls';
import {sortOptionsByRankAsc} from './rank_utils';

import './ranked_schema_modal.scss';

type Props = {
    field: UserPropertyField;
    onSave: (field: UserPropertyField) => void;
    onExited: () => void;
};

type Row = {
    clientId: string;
    id: string;
    name: string;
    color?: string;
};

// Rows are listed lowest-first, so the rank shown for a row is just its position
// from the top (1-based). Reordering or removing rows therefore always leaves
// the ranks as the contiguous integers 1…length with no gaps or duplicates.
const rankForIndex = (index: number): number => index + 1;

// A read-only reorder surface for a ranked schema. Values are shown as chips,
// lowest rank at the top; the rank itself is derived from position so dragging a
// row — or removing one — renumbers the rest automatically. Labels can't be
// edited here (that's done from the table), but new values can be appended.
const RankedSchemaModal = ({field, onSave, onExited}: Props) => {
    const {formatMessage} = useIntl();

    const clientIdCounter = useRef(0);
    const makeRow = useCallback((option: Pick<PropertyFieldOption, 'id' | 'name' | 'color'>): Row => ({
        clientId: `rank-row-${clientIdCounter.current++}`,
        id: option.id,
        name: option.name,
        color: option.color,
    }), []);

    // Seed lowest-rank-first; from here on array order is the source of truth and
    // ranks are derived from it.
    const [rows, setRows] = useState<Row[]>(() => sortOptionsByRankAsc(field.attrs.options ?? []).map(makeRow));

    // The "Add value" affordance is a link until clicked, then an inline input.
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState('');
    const addInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (adding) {
            addInputRef.current?.focus();
        }
    }, [adding]);

    const trimmedDraft = draft.trim();
    const isDuplicate = Boolean(trimmedDraft) && rows.some((row) => row.name === trimmedDraft);

    const moveRow = useCallback((fromIndex: number, toIndex: number) => {
        setRows((prev) => {
            const clampedTo = Math.max(0, Math.min(toIndex, prev.length - 1));
            if (fromIndex === clampedTo || fromIndex < 0 || fromIndex >= prev.length) {
                return prev;
            }
            const reordered = [...prev];
            const [moved] = reordered.splice(fromIndex, 1);
            reordered.splice(clampedTo, 0, moved);
            return reordered;
        });
    }, []);

    const handleDragEnd = useCallback((result: DropResult) => {
        if (!result.destination) {
            return;
        }
        moveRow(result.source.index, result.destination.index);
    }, [moveRow]);

    const removeRow = useCallback((clientId: string) => {
        setRows((prev) => prev.filter((row) => row.clientId !== clientId));
    }, []);

    // Appends a typed value as the new highest rank. A blank or duplicate name is
    // ignored. Returns whether a value was added.
    const commitNewValue = useCallback((): boolean => {
        if (!trimmedDraft || isDuplicate) {
            return false;
        }
        setRows((prev) => [...prev, makeRow({id: '', name: trimmedDraft})]);
        setDraft('');
        return true;
    }, [trimmedDraft, isDuplicate, makeRow]);

    const closeAdd = useCallback(() => {
        setAdding(false);
        setDraft('');
    }, []);

    const handleConfirm = useCallback(() => {
        if (rows.length === 0) {
            return;
        }
        const options: PropertyFieldOption[] = rows.map((row, index) => ({
            id: row.id,
            name: row.name,
            rank: rankForIndex(index),
            ...(row.color === undefined ? {} : {color: row.color}),
        }));
        onSave({...field, attrs: {...field.attrs, options}});
        onExited();
    }, [rows, field, onSave, onExited]);

    return (
        <GenericModal
            id='rankedSchemaModal'
            className='ranked-schema-modal'
            compassDesign={true}
            bodyDivider={true}
            footerDivider={true}
            modalHeaderText={(
                <>
                    <span className='ranked-schema-modal__title-name'>{field.name}</span>
                    <span className='ranked-schema-modal__title-suffix'>
                        <FormattedMessage
                            id='admin.system_properties.user_properties.ranked_modal.attribute_suffix'
                            defaultMessage='Ranked attribute'
                        />
                    </span>
                </>
            )}
            confirmButtonText={(
                <FormattedMessage
                    id='save'
                    defaultMessage='Save'
                />
            )}
            handleConfirm={handleConfirm}
            handleCancel={onExited}
            onExited={onExited}
            isConfirmDisabled={rows.length === 0}
        >
            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId='ranked-schema-rows'>
                    {(droppableProvided) => (
                        <div
                            ref={droppableProvided.innerRef}
                            {...droppableProvided.droppableProps}
                            className='ranked-schema-modal__rows'
                        >
                            {rows.map((row, index) => {
                                const extreme = (() => {
                                    if (index === 0) {
                                        return formatMessage({
                                            id: 'admin.system_properties.user_properties.ranked_modal.lowest',
                                            defaultMessage: 'Lowest',
                                        });
                                    }
                                    if (index === rows.length - 1) {
                                        return formatMessage({
                                            id: 'admin.system_properties.user_properties.ranked_modal.highest',
                                            defaultMessage: 'Highest',
                                        });
                                    }
                                    return null;
                                })();

                                return (
                                    <Draggable
                                        key={row.clientId}
                                        draggableId={row.clientId}
                                        index={index}
                                    >
                                        {(draggableProvided, snapshot) => {
                                            const rowContent = (
                                                <div
                                                    ref={draggableProvided.innerRef}
                                                    {...draggableProvided.draggableProps}
                                                    className='ranked-schema-modal__row'
                                                    data-testid='rankedSchemaRow'
                                                >
                                                    <span
                                                        className='ranked-schema-modal__drag-handle'
                                                        {...draggableProvided.dragHandleProps}
                                                        aria-label={formatMessage({
                                                            id: 'admin.system_properties.user_properties.ranked_modal.drag_handle',
                                                            defaultMessage: 'Drag to reorder',
                                                        })}
                                                    >
                                                        <DragVerticalIcon size={18}/>
                                                    </span>
                                                    <span className='ranked-schema-modal__chip'>
                                                        {row.name}
                                                    </span>
                                                    {extreme && (
                                                        <span className='ranked-schema-modal__extreme'>
                                                            {extreme}
                                                        </span>
                                                    )}
                                                    <span className='ranked-schema-modal__rank'>
                                                        {rankForIndex(index)}
                                                    </span>
                                                    <button
                                                        type='button'
                                                        className='ranked-schema-modal__remove'
                                                        onClick={() => removeRow(row.clientId)}
                                                        aria-label={formatMessage({
                                                            id: 'admin.system_properties.user_properties.ranked_modal.remove',
                                                            defaultMessage: 'Remove value',
                                                        })}
                                                    >
                                                        <TrashCanOutlineIcon size={18}/>
                                                    </button>
                                                </div>
                                            );

                                            // While dragging, render through a portal on document.body so the
                                            // fixed-positioned drag clone escapes the modal dialog's transform,
                                            // which would otherwise throw it off to the side.
                                            return snapshot.isDragging ? createPortal(rowContent, document.body) : rowContent;
                                        }}
                                    </Draggable>
                                );
                            })}
                            {droppableProvided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
            {adding ? (
                <div
                    className='ranked-schema-modal__row ranked-schema-modal__adding-row'
                    data-testid='rankedSchemaRow'
                >
                    <span
                        className='ranked-schema-modal__drag-handle ranked-schema-modal__drag-handle--disabled'
                        aria-hidden={true}
                    >
                        <DragVerticalIcon size={18}/>
                    </span>
                    <input
                        ref={addInputRef}
                        type='text'
                        className='ranked-schema-modal__add-input'
                        value={draft}
                        maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                        placeholder={formatMessage({
                            id: 'admin.system_properties.user_properties.rank_values.add_placeholder',
                            defaultMessage: 'Add value…',
                        })}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => {
                            commitNewValue();
                            closeAdd();
                        }}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Enter') {
                                // Commit the value instead of letting the modal confirm and close.
                                e.preventDefault();
                                e.stopPropagation();
                                commitNewValue();
                            } else if (e.key === 'Escape') {
                                closeAdd();
                            }
                        }}
                    />
                </div>
            ) : (
                <button
                    type='button'
                    className='ranked-schema-modal__add'
                    onClick={() => setAdding(true)}
                >
                    <PlusIcon size={16}/>
                    <FormattedMessage
                        id='admin.system_properties.user_properties.ranked_modal.add_value'
                        defaultMessage='Add value'
                    />
                </button>
            )}
            {isDuplicate && (
                <DangerText>
                    {formatMessage({
                        id: 'admin.system_properties.user_properties.table.validation.values_unique',
                        defaultMessage: 'Values must be unique.',
                    })}
                </DangerText>
            )}
        </GenericModal>
    );
};

export default RankedSchemaModal;
