// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {LockOutlineIcon, PencilOutlineIcon, PlusIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {getPropertyFieldLabel, isPropertyFieldEditable, isPropertyFieldRequired} from 'mattermost-redux/utils/property_utils';

import useCanSetChannelAttributes from 'components/common/hooks/useCanSetChannelAttributes';
import {selectChannelInfoAttributes} from 'components/common/hooks/useChannelInfoAttributes';
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

// Date and user-valued attributes are storable through the API but have no editor
// in this release, so they stay read-only rather than offering a dead affordance.
function hasEditor(field: PropertyField): boolean {
    return field.type === 'text' || field.type === 'select' || field.type === 'multiselect' || field.type === 'rank';
}

type Props = {
    channelId: string;
};

/**
 * The CHANNEL ATTRIBUTES block in Channel Info. A locked attribute is shown with
 * its reason rather than hidden: hiding it makes a correctly configured channel
 * look like one missing a marking.
 */
const ChannelInfoAttributes = ({channelId}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    // One resolved list, two views: a second hook would duplicate the fetch.
    const allAttributes = useResolvedChannelAttributes(channelId);
    const listed = useMemo(() => selectChannelInfoAttributes(allAttributes), [allAttributes]);
    const canSet = useCanSetChannelAttributes(channelId);

    const [editingFieldId, setEditingFieldId] = useState<string>();
    const [savingFieldId, setSavingFieldId] = useState<string>();
    const [failedFieldId, setFailedFieldId] = useState<string>();

    // Added through Add Attribute this session; nothing else keeps their row up.
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

        // Re-derived from the selector so a revealed attribute lands at its sort_order.
        return allAttributes.filter((attribute) => byId.has(attribute.field.id));
    }, [listed, revealedFieldIds, allAttributes]);

    const addableAttributes = useMemo(() => allAttributes.filter((attribute) => {
        if (attribute.displayValue || isPropertyFieldRequired(attribute.field)) {
            return false;
        }
        if (revealedFieldIds.includes(attribute.field.id)) {
            return false;
        }
        return hasEditor(attribute.field) && canSet(attribute.field, false);
    }), [allAttributes, revealedFieldIds, canSet]);

    // Channel Info survives a channel switch, so a row left open would reappear
    // open over a different channel's value.
    useEffect(() => {
        setEditingFieldId(undefined);
        setSavingFieldId(undefined);
        setFailedFieldId(undefined);
        setRevealedFieldIds([]);
    }, [channelId]);

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const handleSubmit = useCallback(async (field: PropertyField, value: ChannelAttributeValue) => {
        setSavingFieldId(field.id);
        setFailedFieldId(undefined);
        try {
            await setChannelAttributeValue(dispatch, channelId, field.id, value);
            if (!isMountedRef.current) {
                return;
            }
            setEditingFieldId(undefined);
            setRevealedFieldIds((prev) => prev.filter((id) => id !== field.id));
        } catch {
            // Named in the row: the failure belongs beside the value it did not save.
            if (isMountedRef.current) {
                setFailedFieldId(field.id);
            }
        } finally {
            if (isMountedRef.current) {
                setSavingFieldId(undefined);
            }
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
                const hasValue = Boolean(attribute.displayValue);
                const locked = hasValue && !isPropertyFieldEditable(field);
                const editable = hasEditor(field) && canSet(field, hasValue);
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
                                    data-testid={`channelInfoAttributeLock-${field.name}`}
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
                                        <span
                                            className='ChannelInfoAttributes__empty'
                                            data-testid={`channelInfoAttributeUnset-${field.name}`}
                                        >
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
                            data-testid={`channelInfoAddAttribute-${attribute.field.name}`}
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
