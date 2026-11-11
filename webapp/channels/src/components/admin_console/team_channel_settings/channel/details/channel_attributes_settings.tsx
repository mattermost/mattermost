// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {CheckIcon, ChevronDownIcon, CloseCircleIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {ACCESS_CONTROL_PROPERTY_GROUP, CHANNEL_OBJECT_TYPE} from 'mattermost-redux/constants/properties';
import {isChannelAttributesRequiredEnabled} from 'mattermost-redux/selectors/entities/general';
import {canMoveToOption, getPropertyFieldChangePolicy, getPropertyFieldLabel, isPropertyFieldRequired, isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

import useChannelAttributes from 'components/common/hooks/useChannelAttributes';
import useResolvedChannelAttributes from 'components/common/hooks/useResolvedChannelAttributes';
import * as Menu from 'components/menu';
import {asGraphFieldRef} from 'components/property_fields/graph';
import AssignmentGraphPicker from 'components/property_fields/hierarchical_value_menu/assignment_picker';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import './channel_attributes_settings.scss';

export type PendingChannelAttributeValue = string | string[] | null;

export type MissingRequiredChannelAttribute = {
    fieldId: string;
    label: string;

    // The channel had a value and this page's pending edits remove it, as
    // opposed to a channel that never had one (e.g. one being unarchived).
    cleared: boolean;
};

type Props = {
    channelId: string;
    isDisabled?: boolean;
    onChange: (values: Record<string, PendingChannelAttributeValue>) => void;

    // Required attributes this page can edit that would be saved without a
    // value. The page decides which of them block Save.
    onMissingRequiredChange?: (missing: MissingRequiredChannelAttribute[]) => void;

    // Marks each attribute still in onMissingRequiredChange's list, once a
    // Save has been refused because of them.
    showRequiredErrors?: boolean;
};

// Types this page has an editor for. A required attribute of any other type
// can't be filled in here, so it never blocks Save.
const EDITABLE_FIELD_TYPES = new Set(['text', 'graph', 'select', 'multiselect', 'rank']);

function fieldOptions(field: PropertyField): PropertyFieldOption[] {
    return (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
}

function selectedOptionIds(rawValue: unknown): string[] {
    if (Array.isArray(rawValue)) {
        return rawValue.filter((id): id is string => typeof id === 'string');
    }
    if (typeof rawValue === 'string' && rawValue) {
        return [rawValue];
    }
    return [];
}

/**
 * The bulk-remediation surface for MM-70717: a sysadmin can set every channel
 * attribute's value for this one channel directly, instead of visiting each
 * channel from the notify-admins flow or the missing-values list.
 *
 * Edits are batched under the page's own Save (unlike the Channel Info RHS
 * editor, which saves per-field immediately) -- this page already commits
 * every other section's edits together, and these controls should behave the
 * same way. The controls themselves reuse the same building blocks Global
 * Attributes and Channel Info use: a bordered dropdown with wrapping value
 * chips for select/multiselect/rank, and the hierarchical picker for graph.
 */
const ChannelAttributesSettings = ({channelId, isDisabled, onChange, onMissingRequiredChange, showRequiredErrors}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const {enabled, loading: fieldsLoading, fields} = useChannelAttributes();
    const requiredEnforced = useSelector(isChannelAttributesRequiredEnabled);

    // Fields are warmed by useChannelAttributes; this channel's own values are
    // not fetched anywhere on this page, so they need their own warm-up here.
    const [valuesLoaded, setValuesLoaded] = useState(false);
    useEffect(() => {
        if (!enabled) {
            return;
        }
        setValuesLoaded(false);
        Client4.getPropertyValues(ACCESS_CONTROL_PROPERTY_GROUP, CHANNEL_OBJECT_TYPE, channelId).then((values) => {
            if (values && values.length > 0) {
                dispatch({
                    type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                    data: {values},
                });
            }
            setValuesLoaded(true);
        }).catch(() => {
            // Fields still render with "Not set"; a fetch failure here should
            // not hide the whole section.
            setValuesLoaded(true);
        });
    }, [enabled, channelId, dispatch]);

    const attributes = useResolvedChannelAttributes(channelId);

    const [pending, setPending] = useState<Record<string, PendingChannelAttributeValue>>({});

    const handleFieldChange = useCallback((fieldId: string, value: PendingChannelAttributeValue) => {
        setPending((prev) => {
            const next = {...prev, [fieldId]: value};
            onChange(next);
            return next;
        });
    }, [onChange]);

    // Empty until the channel's values load, so a slow fetch never reads as
    // every required attribute being unset.
    const missingRequired = useMemo<MissingRequiredChannelAttribute[]>(() => {
        if (!enabled || !requiredEnforced || !valuesLoaded) {
            return [];
        }
        return attributes.flatMap(({field, value}) => {
            if (!isPropertyFieldRequired(field) || !EDITABLE_FIELD_TYPES.has(field.type) || field.permission_values === 'none') {
                return [];
            }
            const savedSet = isPropertyValueSet(value?.value);
            const effective = field.id in pending ? pending[field.id] : value?.value;
            if (isPropertyValueSet(effective)) {
                return [];
            }
            return [{fieldId: field.id, label: getPropertyFieldLabel(field), cleared: savedSet}];
        });
    }, [enabled, requiredEnforced, valuesLoaded, attributes, pending]);

    const missingRequiredKey = missingRequired.map((m) => `${m.fieldId}:${m.cleared}`).join(',');
    useEffect(() => {
        onMissingRequiredChange?.(missingRequired);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [missingRequiredKey, onMissingRequiredChange]);

    if (!enabled || (!fieldsLoading && fields.length === 0)) {
        return null;
    }

    const missingRequiredIds = new Set(missingRequired.map((m) => m.fieldId));

    return (
        <AdminPanel
            id='channel_attributes_settings'
            title={defineMessage({id: 'admin.channel_settings.channel_detail.attributesTitle', defaultMessage: 'Channel attributes'})}
            subtitle={defineMessage({id: 'admin.channel_settings.channel_detail.attributesDescription', defaultMessage: 'Set this channel\'s value for each channel attribute.'})}
        >
            <div
                className='ChannelAttributesSettings AdminPanel__content'
                data-testid='channelAttributesSettings'
            >
                {attributes.map(({field, value}) => {
                    const savedRaw = value?.value;
                    const hasValue = isPropertyValueSet(savedRaw);
                    const policy = getPropertyFieldChangePolicy(field);
                    const currentOptionId = typeof savedRaw === 'string' ? savedRaw : undefined;
                    const options = fieldOptions(field);

                    // Same rule as the Channel Info editor: only a policy that
                    // allows any change lets an existing value be cleared.
                    const clearable = policy === 'any' || !hasValue;
                    const reachableOptions = options.filter((option) => option.id === currentOptionId || canMoveToOption(field, savedRaw, option.id));
                    const stuck = field.type !== 'text' && hasValue && !clearable && reachableOptions.every((option) => option.id === currentOptionId);
                    const locked = field.permission_values === 'none' || (hasValue && (policy === 'never' || stuck));
                    const disabled = Boolean(isDisabled) || locked || !valuesLoaded;
                    const showRequiredError = Boolean(showRequiredErrors) && missingRequiredIds.has(field.id);

                    const rawValue = field.id in pending ? pending[field.id] : (savedRaw ?? null);
                    const label = getPropertyFieldLabel(field);
                    const inputId = `channelAttributesSettings-${field.name}`;

                    let control: React.ReactNode;
                    if (field.type === 'text') {
                        const text = typeof rawValue === 'string' ? rawValue : '';
                        control = (
                            <input
                                id={inputId}
                                type='text'
                                className='ChannelAttributesSettings__input'
                                value={text}
                                disabled={disabled}
                                onChange={(e) => handleFieldChange(field.id, e.target.value || null)}
                                data-testid={inputId}
                            />
                        );
                    } else if (field.type === 'graph') {
                        // Same hierarchical picker Global Attributes and the Channel Info
                        // RHS use for graph fields.
                        const ids = selectedOptionIds(rawValue);
                        control = (
                            <AssignmentGraphPicker
                                field={asGraphFieldRef(field)}
                                ids={ids}
                                onIdsChange={(next) => handleFieldChange(field.id, next.length ? next : null)}
                                menuId={`${inputId}-menu`}
                                buttonId={inputId}
                                buttonDataTestId={inputId}
                                placeholder={formatMessage({id: 'admin.channel_settings.channel_detail.attributes.not_set', defaultMessage: 'Not set'})}
                                ariaLabel={label}
                                disabled={disabled}
                            />
                        );
                    } else if (field.type === 'select' || field.type === 'multiselect' || field.type === 'rank') {
                        // TODO: this duplicates ChannelAttributeRowEditor's Menu-based
                        // select/multiselect logic with a differently-styled trigger.
                        // Extract a shared OptionsMenuControl (selection logic + a
                        // pluggable trigger renderer) so both consumers stay in sync.
                        const isMulti = field.type === 'multiselect';
                        const selectedIds = selectedOptionIds(rawValue);
                        const selectedOptions = selectedIds.map((id) => options.find((option) => option.id === id)).filter((option): option is PropertyFieldOption => Boolean(option));

                        const handlePick = (optionId: string) => {
                            if (isMulti) {
                                const next = selectedIds.includes(optionId) ? selectedIds.filter((id) => id !== optionId) : [...selectedIds, optionId];
                                handleFieldChange(field.id, next.length ? next : null);
                            } else {
                                handleFieldChange(field.id, optionId);
                            }
                        };
                        const handleRemove = (optionId: string) => {
                            if (isMulti) {
                                handlePick(optionId);
                            } else {
                                handleFieldChange(field.id, null);
                            }
                        };

                        control = (
                            <Menu.Container
                                menuButton={{
                                    id: inputId,
                                    dataTestId: inputId,
                                    as: 'button',
                                    class: 'ChannelAttributesSettings__select',
                                    disabled,
                                    'aria-label': label,
                                    children: (
                                        <span className='ChannelAttributesSettings__selectInner'>
                                            {selectedOptions.length > 0 ? (
                                                <span className='ChannelAttributesSettings__chips'>
                                                    {selectedOptions.map((option) => (
                                                        <span
                                                            key={option.id}
                                                            className='ChannelAttributesSettings__chip'
                                                        >
                                                            <span className='ChannelAttributesSettings__chipLabel'>{option.name}</span>
                                                            {clearable && !disabled && (
                                                                <span
                                                                    className='ChannelAttributesSettings__chipRemove'
                                                                    role='button'
                                                                    tabIndex={0}
                                                                    aria-label={formatMessage({id: 'admin.channel_settings.channel_detail.attributes.remove_value', defaultMessage: 'Remove {value}'}, {value: option.name})}

                                                                    // Inside the trigger button: pointerdown must be canceled
                                                                    // or the button activates and reopens the menu the removal
                                                                    // just closed.
                                                                    onPointerDown={(e) => {
                                                                        if (e.button !== 0) {
                                                                            return;
                                                                        }
                                                                        e.stopPropagation();
                                                                        e.preventDefault();
                                                                        handleRemove(option.id);
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        e.preventDefault();
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            handleRemove(option.id);
                                                                        }
                                                                    }}
                                                                >
                                                                    <CloseCircleIcon size={14}/>
                                                                </span>
                                                            )}
                                                        </span>
                                                    ))}
                                                </span>
                                            ) : (
                                                <span className='ChannelAttributesSettings__placeholder'>
                                                    <FormattedMessage
                                                        id='admin.channel_settings.channel_detail.attributes.not_set'
                                                        defaultMessage='Not set'
                                                    />
                                                </span>
                                            )}
                                            <ChevronDownIcon size={16}/>
                                        </span>
                                    ),
                                }}
                                menu={{
                                    id: `${inputId}-menu`,
                                    'aria-label': label,
                                }}
                            >
                                {reachableOptions.map((option) => (
                                    <Menu.Item
                                        key={option.id}
                                        id={`${inputId}-${option.id}`}
                                        data-testid={option === reachableOptions[0] ? inputId : undefined}
                                        labels={<span>{option.name}</span>}
                                        trailingElements={selectedIds.includes(option.id) ? (
                                            <CheckIcon
                                                size={16}
                                                aria-hidden={true}
                                            />
                                        ) : undefined}
                                        onClick={() => handlePick(option.id)}
                                    />
                                ))}
                            </Menu.Container>
                        );
                    } else {
                        // date/user/multiuser have no editor anywhere in the product yet.
                        const text = typeof rawValue === 'string' ? rawValue : '';
                        control = (
                            <span
                                className='ChannelAttributesSettings__readOnly'
                                data-testid={inputId}
                            >
                                {text || formatMessage({id: 'admin.channel_settings.channel_detail.attributes.not_set', defaultMessage: 'Not set'})}
                            </span>
                        );
                    }

                    return (
                        <div
                            className={classNames('ChannelAttributesSettings__row', {'ChannelAttributesSettings__row--error': showRequiredError})}
                            key={field.id}
                            data-testid={`channelAttributesSettingsRow-${field.name}`}
                        >
                            <label htmlFor={field.type === 'date' || field.type === 'user' || field.type === 'multiuser' ? undefined : inputId}>
                                {label}
                            </label>
                            {control}
                            {showRequiredError && (
                                <span className='ChannelAttributesSettings__error'>
                                    <FormattedMessage
                                        id='admin.channel_settings.channel_detail.attributes.required_error'
                                        defaultMessage='This attribute is required. Set a value to save.'
                                    />
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </AdminPanel>
    );
};

export default ChannelAttributesSettings;
