// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {KeyboardEvent} from 'react';
import React, {useMemo, useRef, useState} from 'react';
import type {DropResult} from 'react-beautiful-dnd';
import {DragDropContext, Draggable, Droppable} from 'react-beautiful-dnd';
import type {MessageDescriptor} from 'react-intl';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {ArrowDownIcon, ArrowUpIcon, DragVerticalIcon, PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import type {PropertyFieldOption, UserPropertyField} from '@mattermost/types/properties';

import Constants from 'utils/constants';

import {isValidRank, nextRank} from './rank_utils';

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
    rank: number;
};

type RowError = {descriptor: MessageDescriptor; values?: Record<string, string | number>};

const errorMessages = defineMessages({
    nameRequired: {
        id: 'admin.system_properties.user_properties.ranked_modal.name_required',
        defaultMessage: 'Enter a label.',
    },
    rankInvalid: {
        id: 'admin.system_properties.user_properties.ranked_modal.rank_invalid',
        defaultMessage: 'Rank must be a whole number of at least 1.',
    },
    rankDuplicate: {
        id: 'admin.system_properties.user_properties.ranked_modal.rank_duplicate',
        defaultMessage: 'Rank {rank} is already used by "{label}".',
    },
});

const sortRowsDesc = (rows: Row[]): Row[] => [...rows].sort((a, b) => b.rank - a.rank);

// The deep-edit surface for a ranked schema. Rows are shown highest-rank-first.
// Reordering — by drag, the arrow steppers, or editing a rank — keeps ranks
// unique; a rank edit that collides with another option is rejected inline.
const RankedSchemaModal = ({field, onSave, onExited}: Props) => {
    const {formatMessage} = useIntl();

    const clientIdCounter = useRef(0);
    const makeRow = (option: PropertyFieldOption): Row => ({
        clientId: `rank-row-${clientIdCounter.current++}`,
        id: option.id,
        name: option.name,
        color: option.color,
        rank: option.rank ?? 0,
    });

    const [rows, setRows] = useState<Row[]>(() => sortRowsDesc((field.attrs.options ?? []).map(makeRow)));

    // In-progress rank edits, keyed by clientId. A row's committed rank stays put
    // until the draft is a valid, unique integer.
    const [rankDrafts, setRankDrafts] = useState<Record<string, string>>({});

    const effectiveRank = (row: Row): number => {
        const draft = rankDrafts[row.clientId];
        if (draft !== undefined) {
            const parsed = Number(draft);
            if (draft.trim() !== '' && Number.isInteger(parsed)) {
                return parsed;
            }
        }
        return row.rank;
    };

    const rowErrors = useMemo(() => {
        const errors: Record<string, RowError> = {};
        rows.forEach((row) => {
            if (!row.name.trim()) {
                errors[row.clientId] = {descriptor: errorMessages.nameRequired};
                return;
            }
            const draft = rankDrafts[row.clientId];
            if (draft === undefined) {
                return;
            }
            const parsed = Number(draft);
            if (draft.trim() === '' || !Number.isInteger(parsed) || parsed < 1) {
                errors[row.clientId] = {descriptor: errorMessages.rankInvalid};
                return;
            }
            const collision = rows.find((other) => other.clientId !== row.clientId && effectiveRank(other) === parsed);
            if (collision) {
                errors[row.clientId] = {descriptor: errorMessages.rankDuplicate, values: {rank: parsed, label: collision.name}};
            }
        });
        return errors;

        // effectiveRank reads rankDrafts/rows, captured below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, rankDrafts]);

    const hasErrors = Object.keys(rowErrors).length > 0;

    const handleNameChange = (clientId: string, name: string) => {
        setRows((prev) => prev.map((row) => (row.clientId === clientId ? {...row, name} : row)));
    };

    const handleRankChange = (clientId: string, value: string) => {
        setRankDrafts((prev) => ({...prev, [clientId]: value}));
    };

    const commitRank = (clientId: string) => {
        const draft = rankDrafts[clientId];
        if (draft === undefined) {
            return;
        }
        const parsed = Number(draft);
        const isUnique = !rows.some((other) => other.clientId !== clientId && effectiveRank(other) === parsed);
        if (draft.trim() !== '' && isValidRank(parsed) && isUnique) {
            setRows((prev) => sortRowsDesc(prev.map((row) => (row.clientId === clientId ? {...row, rank: parsed} : row))));
            setRankDrafts((prev) => {
                const next = {...prev};
                Reflect.deleteProperty(next, clientId);
                return next;
            });
        }
    };

    const moveRow = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= rows.length) {
            return;
        }
        setRows((prev) => {
            const reordered = [...prev];
            const [moved] = reordered.splice(fromIndex, 1);
            reordered.splice(toIndex, 0, moved);

            // Reassign the existing rank values to the new order (top = highest)
            // so positions never collide.
            const ranksDesc = prev.map((row) => row.rank).sort((a, b) => b - a);
            return reordered.map((row, i) => ({...row, rank: ranksDesc[i]}));
        });
        setRankDrafts({});
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) {
            return;
        }
        moveRow(result.source.index, result.destination.index);
    };

    const addValue = () => {
        const newRow = makeRow({id: '', name: '', rank: nextRank(rows)});
        setRows((prev) => [newRow, ...prev]);
    };

    const removeRow = (clientId: string) => {
        setRows((prev) => prev.filter((row) => row.clientId !== clientId));
        setRankDrafts((prev) => {
            const next = {...prev};
            Reflect.deleteProperty(next, clientId);
            return next;
        });
    };

    const handleConfirm = () => {
        if (hasErrors || rows.length === 0) {
            return;
        }
        const options: PropertyFieldOption[] = rows.map((row) => {
            const draft = rankDrafts[row.clientId];
            const parsed = draft === undefined ? row.rank : Number(draft);
            const rank = isValidRank(parsed) ? parsed : row.rank;
            return {
                id: row.id,
                name: row.name.trim(),
                rank,
                ...(row.color === undefined ? {} : {color: row.color}),
            };
        });
        onSave({...field, attrs: {...field.attrs, options}});
        onExited();
    };

    return (
        <GenericModal
            id='rankedSchemaModal'
            className='ranked-schema-modal'
            compassDesign={true}
            modalHeaderText={(
                <FormattedMessage
                    id='admin.system_properties.user_properties.ranked_modal.title'
                    defaultMessage='Edit ranking'
                />
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
            isConfirmDisabled={hasErrors || rows.length === 0}
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
                                const error = rowErrors[row.clientId];
                                return (
                                    <Draggable
                                        key={row.clientId}
                                        draggableId={row.clientId}
                                        index={index}
                                    >
                                        {(draggableProvided) => (
                                            <div
                                                ref={draggableProvided.innerRef}
                                                {...draggableProvided.draggableProps}
                                                className='ranked-schema-modal__row'
                                            >
                                                <div className='ranked-schema-modal__row-main'>
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
                                                    <div className='ranked-schema-modal__steppers'>
                                                        <button
                                                            type='button'
                                                            className='ranked-schema-modal__stepper'
                                                            onClick={() => moveRow(index, index - 1)}
                                                            disabled={index === 0}
                                                            aria-label={formatMessage({
                                                                id: 'admin.system_properties.user_properties.ranked_modal.move_up',
                                                                defaultMessage: 'Move up',
                                                            })}
                                                        >
                                                            <ArrowUpIcon size={14}/>
                                                        </button>
                                                        <button
                                                            type='button'
                                                            className='ranked-schema-modal__stepper'
                                                            onClick={() => moveRow(index, index + 1)}
                                                            disabled={index === rows.length - 1}
                                                            aria-label={formatMessage({
                                                                id: 'admin.system_properties.user_properties.ranked_modal.move_down',
                                                                defaultMessage: 'Move down',
                                                            })}
                                                        >
                                                            <ArrowDownIcon size={14}/>
                                                        </button>
                                                    </div>
                                                    <input
                                                        type='text'
                                                        className='ranked-schema-modal__name-input form-control'
                                                        value={row.name}
                                                        maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                                                        placeholder={formatMessage({
                                                            id: 'admin.system_properties.user_properties.ranked_modal.label_placeholder',
                                                            defaultMessage: 'Label',
                                                        })}
                                                        onChange={(e) => handleNameChange(row.clientId, e.target.value)}
                                                    />
                                                    <input
                                                        type='number'
                                                        min={1}
                                                        className='ranked-schema-modal__rank-input form-control'
                                                        value={rankDrafts[row.clientId] ?? String(row.rank)}
                                                        aria-label={formatMessage({
                                                            id: 'admin.system_properties.user_properties.ranked_modal.rank_aria',
                                                            defaultMessage: 'Rank',
                                                        })}
                                                        aria-invalid={Boolean(error)}
                                                        onChange={(e) => handleRankChange(row.clientId, e.target.value)}
                                                        onBlur={() => commitRank(row.clientId)}
                                                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                commitRank(row.clientId);
                                                            }
                                                        }}
                                                    />
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
                                                {error && (
                                                    <div
                                                        className='ranked-schema-modal__error'
                                                        role='alert'
                                                        aria-live='polite'
                                                    >
                                                        <FormattedMessage
                                                            {...error.descriptor}
                                                            values={error.values}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Draggable>
                                );
                            })}
                            {droppableProvided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
            <button
                type='button'
                className='ranked-schema-modal__add'
                onClick={addValue}
            >
                <PlusIcon size={16}/>
                <FormattedMessage
                    id='admin.system_properties.user_properties.ranked_modal.add_value'
                    defaultMessage='Add value'
                />
            </button>
        </GenericModal>
    );
};

export default RankedSchemaModal;
