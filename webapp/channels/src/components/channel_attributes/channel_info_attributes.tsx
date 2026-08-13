// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {LockOutlineIcon, PencilOutlineIcon, PlusIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {getPropertyFieldLabel, isPropertyFieldEditable, isPropertyFieldRequired} from 'mattermost-redux/utils/property_utils';

import useCanSetChannelAttributes from 'components/common/hooks/useCanSetChannelAttributes';
import useChannelInfoAttributes from 'components/common/hooks/useChannelInfoAttributes';
import useResolvedChannelAttributes from 'components/common/hooks/useResolvedChannelAttributes';
import * as Menu from 'components/menu';

import AttributeChip from './attribute_chip';
import ChannelAttributeRowEditor from './channel_attribute_row_editor';
import type {ChannelAttributeValue} from './set_channel_attribute_value';
import {setChannelAttributeValue} from './set_channel_attribute_value';

import './channel_info_attributes.scss';

function optionColor(attribute: ResolvedChannelAttribute): string | undefined {
    const color = attribute.option?.color;
    return typeof color === 'string' && color ? color : undefined;
}

// Only the shapes with an assignment control. Date and user-valued attributes are
// storable through the API but have no editor in this release, so they are shown
// read-only rather than offering an edit that cannot be completed.
function hasEditor(field: PropertyField): boolean {
    return field.type === 'text' || field.type === 'select' || field.type === 'multiselect' || field.type === 'rank';
}

type Props = {
    channelId: string;
};

/**
 * The CHANNEL ATTRIBUTES block in Channel Info, with editing where the attribute
 * and the viewer both allow it.
 *
 * A locked attribute is shown with the reason rather than hidden: hiding it would
 * make a correctly configured channel look like one missing a marking.
 */
const ChannelInfoAttributes = ({channelId}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const listed = useChannelInfoAttributes(channelId);
    const allAttributes = useResolvedChannelAttributes(channelId);
    const canSet = useCanSetChannelAttributes(channelId);

    const [editingFieldId, setEditingFieldId] = useState<string>();
    const [savingFieldId, setSavingFieldId] = useState<string>();
    const [failedFieldId, setFailedFieldId] = useState<string>();

    // Optional attributes the viewer added through Add Attribute this session.
    // They have no value yet, so nothing else would keep their row on screen.
    const [revealedFieldIds, setRevealedFieldIds] = useState<string[]>([]);

    const rows = useMemo(() => {
        const byId = new Map(listed.map((attribute) => [attribute.field.id, attribute]));
        for (const id of revealedFieldIds) {
            if (!byId.has(id)) {
                const attribute = allAttributes.find((candidate) => candidate.field.id === id);
                if (attribute) {
                    byId.set(id, attribute);
                }
            }
        }

        // Re-derive order from the selector's ordering rather than insertion order,
        // so a revealed attribute lands where its sort_order says it belongs.
        return allAttributes.filter((attribute) => byId.has(attribute.field.id));
    }, [listed, revealedFieldIds, allAttributes]);

    const addableAttributes = useMemo(() => allAttributes.filter((attribute) => {
        if (attribute.displayValue || isPropertyFieldRequired(attribute.field)) {
            return false;
        }
        if (revealedFieldIds.includes(attribute.field.id)) {
            return false;
        }
        return hasEditor(attribute.field) && canSet(attribute.field);
    }), [allAttributes, revealedFieldIds, canSet]);

    const handleSubmit = useCallback(async (field: PropertyField, value: ChannelAttributeValue) => {
        setSavingFieldId(field.id);
        setFailedFieldId(undefined);
        try {
            await setChannelAttributeValue(dispatch, channelId, field.id, value);
            setEditingFieldId(undefined);
            setRevealedFieldIds((prev) => prev.filter((id) => id !== field.id));
        } catch {
            // Named in the row rather than a toast: the failure belongs next to the
            // value it did not save.
            setFailedFieldId(field.id);
        } finally {
            setSavingFieldId(undefined);
        }
    }, [dispatch, channelId]);

    const handleAdd = useCallback((fieldId: string) => {
        setRevealedFieldIds((prev) => (prev.includes(fieldId) ? prev : [...prev, fieldId]));
        setEditingFieldId(fieldId);
    }, []);

    const handleCancel = useCallback((fieldId: string) => {
        setEditingFieldId(undefined);
        setRevealedFieldIds((prev) => prev.filter((id) => id !== fieldId));
    }, []);

    if (rows.length === 0 && addableAttributes.length === 0) {
        return null;
    }

    return (
        <div
            className='ChannelInfoAttributes'
            data-testid='channelInfoAttributes'
        >
            <div className='ChannelInfoAttributes__heading'>
                <FormattedMessage
                    id='channel_attributes.info.heading'
                    defaultMessage='Channel Attributes'
                />
            </div>

            {rows.map((attribute) => {
                const {field} = attribute;
                const label = getPropertyFieldLabel(field);
                const locked = !isPropertyFieldEditable(field);
                const editable = hasEditor(field) && canSet(field);
                const isEditing = editingFieldId === field.id;

                return (
                    <div
                        key={field.id}
                        className='ChannelInfoAttributes__row'
                        data-testid={`channelInfoAttributeRow-${field.name}`}
                    >
                        <span className='ChannelInfoAttributes__label'>
                            {label}
                            {locked && (
                                <LockOutlineIcon
                                    size={12}
                                    aria-label={formatMessage({
                                        id: 'channel_attributes.info.locked',
                                        defaultMessage: 'This attribute cannot be changed after it is set',
                                    })}
                                />
                            )}
                        </span>

                        <span className='ChannelInfoAttributes__value'>
                            {isEditing ? (
                                <ChannelAttributeRowEditor
                                    field={field}
                                    rawValue={attribute.value?.value}
                                    onSubmit={(value) => handleSubmit(field, value)}
                                    onCancel={() => handleCancel(field.id)}
                                    saving={savingFieldId === field.id}
                                />
                            ) : (
                                <>
                                    {attribute.displayValue ? (
                                        <AttributeChip
                                            label={label}
                                            value={attribute.displayValue}
                                            color={optionColor(attribute)}
                                            announceLabel={false}
                                        />
                                    ) : (
                                        <span className='ChannelInfoAttributes__empty'>
                                            <FormattedMessage
                                                id='channel_attributes.info.not_set'
                                                defaultMessage='Not set'
                                            />
                                        </span>
                                    )}

                                    {editable && (
                                        <button
                                            type='button'
                                            className='ChannelInfoAttributes__edit'
                                            onClick={() => setEditingFieldId(field.id)}
                                            aria-label={formatMessage(
                                                {id: 'channel_attributes.info.edit', defaultMessage: 'Edit {label}'},
                                                {label},
                                            )}
                                            data-testid={`channelInfoAttributeEdit-${field.name}`}
                                        >
                                            <PencilOutlineIcon size={14}/>
                                        </button>
                                    )}
                                </>
                            )}
                        </span>

                        {failedFieldId === field.id && (
                            <span
                                className='ChannelInfoAttributes__error'
                                role='alert'
                                data-testid={`channelInfoAttributeError-${field.name}`}
                            >
                                <FormattedMessage
                                    id='channel_attributes.info.save_failed'
                                    defaultMessage="Couldn't save {label}. Try again."
                                    values={{label}}
                                />
                            </span>
                        )}
                    </div>
                );
            })}

            {addableAttributes.length > 0 && (
                <Menu.Container
                    menuButton={{
                        id: 'channelInfoAddAttributeButton',
                        class: 'ChannelInfoAttributes__add',
                        children: (
                            <>
                                <PlusIcon size={14}/>
                                <FormattedMessage
                                    id='channel_attributes.info.add'
                                    defaultMessage='Add attribute'
                                />
                            </>
                        ),
                        dataTestId: 'channelInfoAddAttributeButton',
                    }}
                    menu={{
                        id: 'channelInfoAddAttributeMenu',
                        'aria-label': formatMessage({id: 'channel_attributes.info.add', defaultMessage: 'Add attribute'}),
                    }}
                >
                    {addableAttributes.map((attribute) => (
                        <Menu.Item
                            key={attribute.field.id}
                            id={`channelInfoAddAttribute-${attribute.field.name}`}
                            onClick={() => handleAdd(attribute.field.id)}
                            labels={<span>{getPropertyFieldLabel(attribute.field)}</span>}
                        />
                    ))}
                </Menu.Container>
            )}
        </div>
    );
};

export default ChannelInfoAttributes;
