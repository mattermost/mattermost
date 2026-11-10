// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {FormattedMessage, defineMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {LockOutlineIcon, PlusIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyFieldOption, PropertyValue} from '@mattermost/types/properties';
import {supportsOptions} from '@mattermost/types/properties';

import {getMyChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {isChannelAttributesRequiredEnabled} from 'mattermost-redux/selectors/entities/general';
import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {resolveDisplayValue} from 'mattermost-redux/selectors/entities/properties';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {canMoveToOption, getPropertyFieldChangePolicy, getPropertyFieldLabel, isPropertyFieldRequired, isPropertyFieldSourceManaged, isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

import {clearPendingChannelAttributeEdit} from 'actions/views/rhs';
import {getPendingChannelAttributeEdit} from 'selectors/rhs';

import useCanSetChannelAttributes from 'components/common/hooks/useCanSetChannelAttributes';
import {selectChannelInfoAttributes} from 'components/common/hooks/useChannelInfoAttributes';
import useFixableMissingRequiredAttributes from 'components/common/hooks/useFixableMissingRequiredAttributes';
import useIsChannelAttributeAdmin from 'components/common/hooks/useIsChannelAttributeAdmin';
import useResolvedChannelAttributes from 'components/common/hooks/useResolvedChannelAttributes';
import * as Menu from 'components/menu';

import {useChannelKind} from 'hooks/useChannelKind';
import type {KindMessages} from 'utils/channel_kind';

import type {GlobalState} from 'types/store';

import AttributeChip from './attribute_chip';
import {hasEditor} from './channel_attribute_editor_support';
import ChannelAttributeRowEditor from './channel_attribute_row_editor';
import MissingValuePill from './missing_value_pill';
import type {ChannelAttributeValue} from './set_channel_attribute_value';
import {setChannelAttributeValue} from './set_channel_attribute_value';

import './channel_info_attributes.scss';

// The server's refusal of an empty value on a required field. Retrying can't
// succeed, so it gets its own message instead of "Try again".
function isRequiredValueError(err: unknown): boolean {
    return Boolean(err && typeof err === 'object' && 'server_error_id' in err &&
        err.server_error_id === 'app.property_value.required.app_error');
}

const EMPTY_ATTRIBUTES: ResolvedChannelAttribute[] = [];

function optionColor(attribute: ResolvedChannelAttribute): string | undefined {
    const color = attribute.option?.color;
    return typeof color === 'string' && color ? color : undefined;
}

// A directional policy can leave nothing to move to — already at the top rung
// under raise_only, or the bottom under lower_only. Offering the editor there
// would open a dropdown with no options in it.
function hasReachableOption(field: PropertyField, rawValue: unknown): boolean {
    if (!supportsOptions(field)) {
        return true;
    }
    const options = (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
    return options.some((option) => canMoveToOption(field, rawValue, option.id));
}

const lockReasons = defineMessages({
    never: {
        id: 'channel_attributes.info.locked',
        defaultMessage: 'This attribute cannot be changed after it is set',
    },
    raise_only: {
        id: 'channel_attributes.info.locked_raise_only',
        defaultMessage: 'This attribute can only be raised, never lowered',
    },
    lower_only: {
        id: 'channel_attributes.info.locked_lower_only',
        defaultMessage: 'This attribute can only be lowered, never raised',
    },
    source_managed: {
        id: 'channel_attributes.info.locked_source_managed',
        defaultMessage: 'This attribute is managed by an integration and cannot be changed here',
    },
});

const headingMessages: KindMessages = {
    channel: defineMessage({
        id: 'channel_attributes.info.heading',
        defaultMessage: 'Channel Attributes',
    }),
    board: defineMessage({
        id: 'channel_attributes.info.heading.board',
        defaultMessage: 'Board Attributes',
    }),
};

type Props = {
    channelId: string;

    // When true, edits are staged locally rather than saved on each change —
    // the host (e.g. a SaveChangesPanel-driven tab) drives flush/discard through
    // the ref handle and decides when a save actually reaches the server.
    deferred?: boolean;
    onPendingChange?: (hasPendingChanges: boolean) => void;
};

export type ChannelInfoAttributesHandle = {
    hasPendingChanges: () => boolean;
    flush: () => Promise<boolean>;
    discard: () => void;
};

// Overlays a staged-but-unsaved value on top of the resolved attribute so a
// deferred edit renders exactly as a saved one would, before it is saved.
function withPendingValue(attribute: ResolvedChannelAttribute, raw: ChannelAttributeValue): ResolvedChannelAttribute {
    const resolved = resolveDisplayValue(attribute.field, raw);
    return {
        ...attribute,
        value: raw === null ? undefined : {...attribute.value, value: raw} as PropertyValue<unknown>,
        ...resolved,
    };
}

/**
 * The CHANNEL ATTRIBUTES block in Channel Info. A locked attribute is shown with
 * its reason rather than hidden: hiding it makes a correctly configured channel
 * look like one missing a marking.
 */
const ChannelInfoAttributes = forwardRef<ChannelInfoAttributesHandle, Props>(({channelId, deferred, onPendingChange}, ref) => {
    const {formatMessage} = useIntl();
    const channelKind = useChannelKind({id: channelId});
    const dispatch = useDispatch();

    // One resolved list, two views: a second hook would duplicate the fetch.
    const resolvedAttributes = useResolvedChannelAttributes(channelId);

    // Staged edits, keyed by field id, only ever populated in deferred mode.
    const [pendingValues, setPendingValues] = useState<Map<string, ChannelAttributeValue>>(() => new Map());

    const allAttributes = useMemo(() => {
        if (pendingValues.size === 0) {
            return resolvedAttributes;
        }
        return resolvedAttributes.map((attribute) => (pendingValues.has(attribute.field.id) ? withPendingValue(attribute, pendingValues.get(attribute.field.id) ?? null) : attribute));
    }, [resolvedAttributes, pendingValues]);

    useEffect(() => {
        onPendingChange?.(pendingValues.size > 0);
    }, [pendingValues, onPendingChange]);

    // Gates editing on top of canSet rather than relying on it: a field carrying the
    // 'member' setter tier would otherwise hand a regular member a pencil, and this
    // panel is read-only for members.
    const isChannelAdmin = useIsChannelAttributeAdmin(channelId);
    const listed = useMemo(() => selectChannelInfoAttributes(allAttributes, isChannelAdmin), [allAttributes, isChannelAdmin]);
    const canSet = useCanSetChannelAttributes(channelId);
    const {fields: fixableMissingFields} = useFixableMissingRequiredAttributes(channelId);
    const fixableMissingIds = useMemo(() => new Set(fixableMissingFields.map((field) => field.id)), [fixableMissingFields]);

    const pendingEdit = useSelector(getPendingChannelAttributeEdit);

    // Whether what decides editability (the viewer's channel membership and its roles,
    // or a system admin role) has arrived. Before that every row reads as not editable.
    const editabilityLoaded = useSelector((state: GlobalState) => {
        if (isCurrentUserSystemAdmin(state)) {
            return true;
        }
        const member = getMyChannelMember(state, channelId);
        if (!member) {
            return false;
        }
        const roles = state.entities.roles.roles;
        return member.roles.split(' ').filter(Boolean).every((roleName) => roleName in roles);
    });

    const [editingFieldId, setEditingFieldId] = useState<string>();
    const [savingFieldId, setSavingFieldId] = useState<string>();
    const [failedFieldId, setFailedFieldId] = useState<string>();
    const [failedAsRequired, setFailedAsRequired] = useState(false);
    const requiredEnforced = useSelector(isChannelAttributesRequiredEnabled);

    // Bumped on every consumed request so a menu that was closed again reopens.
    const [openRequest, setOpenRequest] = useState<{fieldId: string; signal: number}>();

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

    const isRowEditable = useCallback((attribute: ResolvedChannelAttribute) => {
        const {field} = attribute;
        const hasValue = isPropertyValueSet(attribute.value?.value);
        const stuck = hasValue && !hasReachableOption(field, attribute.value?.value);
        return isChannelAdmin && hasEditor(field) && !stuck && canSet(field, hasValue);
    }, [isChannelAdmin, canSet]);

    const addableAttributes = useMemo(() => (isChannelAdmin ? allAttributes.filter((attribute) => {
        // Stored, not rendered: an attribute holding a value that fails to render
        // would otherwise reappear here as something still to fill in.
        if (isPropertyValueSet(attribute.value?.value) || isPropertyFieldRequired(attribute.field)) {
            return false;
        }
        if (revealedFieldIds.includes(attribute.field.id)) {
            return false;
        }
        return hasEditor(attribute.field) && canSet(attribute.field, false);
    }) : EMPTY_ATTRIBUTES), [allAttributes, isChannelAdmin, revealedFieldIds, canSet]);

    // Channel Info survives a channel switch, so a row left open would reappear
    // open over a different channel's value.
    useEffect(() => {
        setEditingFieldId(undefined);
        setSavingFieldId(undefined);
        setFailedFieldId(undefined);
        setRevealedFieldIds([]);
        setPendingValues(new Map());
    }, [channelId]);

    // The panel survives a channel switch, so a save started on one channel can
    // still resolve after the user has moved to another. Fields are keyed by a
    // global template id, so a stale result cannot simply be filtered by field
    // id -- it would still match a same-named field on the new channel.
    const rootRef = useRef<HTMLDivElement>(null);
    const visitTokenRef = useRef(0);
    useEffect(() => {
        visitTokenRef.current += 1;
    }, [channelId]);

    // A later save (even for a different field, within the same channel visit)
    // must win over an earlier one still in flight -- otherwise the earlier
    // save's completion can clear editingFieldId/savingFieldId out from under
    // the field the user is now actively editing or saving.
    const saveSequenceRef = useRef(0);

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const handleSubmit = useCallback(async (field: PropertyField, value: ChannelAttributeValue) => {
        if (deferred) {
            // No network round trip here: the host flushes staged values together
            // on its own Save, so a pick just updates the local map.
            setFailedFieldId(undefined);
            setPendingValues((prev) => {
                const next = new Map(prev);
                next.set(field.id, value);
                return next;
            });
            setEditingFieldId(undefined);
            setRevealedFieldIds((prev) => prev.filter((id) => id !== field.id));
            return;
        }

        const requestVisitToken = visitTokenRef.current;
        const requestSequence = ++saveSequenceRef.current;
        const isStale = () => !isMountedRef.current || visitTokenRef.current !== requestVisitToken || saveSequenceRef.current !== requestSequence;

        setSavingFieldId(field.id);
        setFailedFieldId(undefined);
        try {
            await setChannelAttributeValue(dispatch, channelId, field.id, value);
            if (isStale()) {
                return;
            }
            setEditingFieldId(undefined);
            setRevealedFieldIds((prev) => prev.filter((id) => id !== field.id));
        } catch (err) {
            // Named in the row: the failure belongs beside the value it did not save.
            if (!isStale()) {
                setFailedFieldId(field.id);
                setFailedAsRequired(isRequiredValueError(err));
            }
        } finally {
            if (!isStale()) {
                setSavingFieldId(undefined);
            }
        }
    }, [dispatch, channelId, deferred]);

    useImperativeHandle(ref, () => ({
        hasPendingChanges: () => pendingValues.size > 0,
        discard: () => {
            setPendingValues(new Map());
            setFailedFieldId(undefined);
        },
        flush: async () => {
            if (pendingValues.size === 0) {
                return true;
            }
            for (const [fieldId, value] of pendingValues) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await setChannelAttributeValue(dispatch, channelId, fieldId, value);
                } catch (err) {
                    setFailedFieldId(fieldId);
                    setFailedAsRequired(isRequiredValueError(err));
                    return false;
                }
            }
            setPendingValues(new Map());
            return true;
        },
    }), [pendingValues, dispatch, channelId]);

    const handleAdd = useCallback((fieldId: string) => {
        setRevealedFieldIds((prev) => (prev.includes(fieldId) ? prev : [...prev, fieldId]));
        const added = allAttributes.find((attribute) => attribute.field.id === fieldId);
        if (added?.field.type === 'text') {
            setEditingFieldId(fieldId);
        }
        requestAnimationFrame(() => {
            let el: HTMLElement | null = rootRef.current;
            while (el) {
                if (el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'visible') {
                    el.scrollTop = el.scrollHeight;
                    break;
                }
                el = el.parentElement;
            }
        });
    }, [allAttributes]);

    // A request made from outside (the channel notice, the header chip) names the field
    // to open. It is honoured once and always cleared, so a stale one cannot reopen
    // an editor later. Channel Settings hosts a deferred instance that never takes it.
    useEffect(() => {
        if (deferred || !pendingEdit) {
            return;
        }
        if (pendingEdit.channelId !== channelId) {
            dispatch(clearPendingChannelAttributeEdit());
            return;
        }

        // Fields not loaded yet: keep the request until the rows can answer it.
        if (allAttributes.length === 0) {
            return;
        }

        // Roles not loaded yet: a cold open would read every row as not editable and
        // drop the request, so hold it until the answer can be trusted.
        if (!editabilityLoaded) {
            return;
        }

        const target = rows.find((attribute) => attribute.field.id === pendingEdit.fieldId);
        dispatch(clearPendingChannelAttributeEdit());
        if (!target || !isRowEditable(target)) {
            return;
        }

        const {field} = target;
        setEditingFieldId(field.id);
        setOpenRequest((previous) => ({fieldId: field.id, signal: (previous?.signal ?? 0) + 1}));
        requestAnimationFrame(() => {
            const row = rootRef.current?.querySelector(`[data-testid="channelInfoAttributeRow-${field.name}"]`);
            row?.scrollIntoView({block: 'nearest'});

            // Text focuses its own input and an option menu its first item; only the
            // graph picker, which has no menu to open, takes focus on its trigger.
            if (field.type === 'graph') {
                document.getElementById(`channelInfoAttributeEdit-${field.name}`)?.focus();
            }
        });
    }, [deferred, pendingEdit, channelId, allAttributes, rows, isRowEditable, editabilityLoaded, dispatch]);

    const handleCancel = useCallback((fieldId: string) => {
        setEditingFieldId(undefined);
        setRevealedFieldIds((prev) => prev.filter((id) => id !== fieldId));
    }, []);

    if (rows.length === 0 && addableAttributes.length === 0) {
        return null;
    }

    return (
        <div
            ref={rootRef}
            className='ChannelInfoAttributes'
            data-testid='channelInfoAttributes'
        >
            <div className='ChannelInfoAttributes__heading'>
                <FormattedMessage {...headingMessages[channelKind]}/>
            </div>

            <div className='ChannelInfoAttributes__body'>
                <div className='ChannelInfoAttributes__list'>
                    {rows.map((attribute) => {
                        const {field} = attribute;
                        const label = getPropertyFieldLabel(field);

                        // Read off the stored value, not the rendered one: a value that
                        // fails to render (a deleted option, a type with no display path)
                        // is still a value, and the server will refuse to replace it.
                        const hasValue = isPropertyValueSet(attribute.value?.value);
                        const policy = getPropertyFieldChangePolicy(field);
                        const stuck = hasValue && !hasReachableOption(field, attribute.value?.value);

                        // An integration owns this attribute's values whether or not one is
                        // set yet, so unlike the change policy this locks an empty row too.
                        const sourceManaged = isPropertyFieldSourceManaged(field);
                        const locked = sourceManaged || (hasValue && (policy === 'never' || stuck));
                        const lockReason = sourceManaged ? lockReasons.source_managed : (lockReasons[policy as keyof typeof lockReasons] ?? lockReasons.never);
                        const isText = field.type === 'text';
                        const editable = isRowEditable(attribute);
                        const isMissing = editable && !hasValue && fixableMissingIds.has(field.id);
                        const isEditing = editingFieldId === field.id;
                        const showMenu = editable && !isText;
                        const showTextEditor = editable && isText && isEditing;

                        let valueControl: React.ReactNode;
                        if (showMenu || showTextEditor) {
                            valueControl = (
                                <ChannelAttributeRowEditor
                                    key={`${channelId}-${field.id}`}
                                    field={field}
                                    rawValue={attribute.value?.value}
                                    displayValue={attribute.displayValue}
                                    color={optionColor(attribute)}
                                    onSubmit={(value) => handleSubmit(field, value)}
                                    onCancel={() => handleCancel(field.id)}
                                    saving={savingFieldId === field.id}
                                    missing={isMissing}
                                    openSignal={openRequest?.fieldId === field.id ? openRequest.signal : 0}
                                    required={requiredEnforced && isPropertyFieldRequired(field)}
                                />
                            );
                        } else if (editable && isText) {
                            valueControl = (
                                <button
                                    type='button'
                                    className='ChannelInfoAttributes__valueTrigger'
                                    onClick={() => setEditingFieldId(field.id)}
                                    aria-label={formatMessage(
                                        {id: 'channel_attributes.info.edit', defaultMessage: 'Edit {label}'},
                                        {label},
                                    )}
                                    data-testid={`channelInfoAttributeEdit-${field.name}`}
                                >
                                    {attribute.displayValue && (
                                        <span
                                            className='ChannelInfoAttributes__textValue'
                                            data-testid={`channelInfoAttributeTextValue-${field.name}`}
                                        >
                                            {attribute.displayValue}
                                        </span>
                                    )}
                                    {!attribute.displayValue && isMissing && <MissingValuePill field={field}/>}
                                    {!attribute.displayValue && !isMissing && (
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
                                </button>
                            );
                        } else if (attribute.displayValue) {
                            // One chip per value, as the header chips already do: a
                            // multiselect's displayValue is its values joined with
                            // commas, which reads as one marking rather than several.
                            // Colour only when there is a single value — an array
                            // value resolves no option, so there is none to take.
                            const values = attribute.displayValues.length > 0 ? attribute.displayValues : [attribute.displayValue];
                            valueControl = values.length === 1 ? (
                                <AttributeChip
                                    className='ChannelInfoAttributes__chip'
                                    label={label}
                                    value={values[0]}
                                    color={optionColor(attribute)}
                                    announceLabel={false}
                                    size='medium'
                                />
                            ) : (
                                <span className='ChannelInfoAttributes__chips'>
                                    {values.map((value) => (
                                        <AttributeChip
                                            key={`${field.id}:${value}`}
                                            className='ChannelInfoAttributes__chip'
                                            label={label}
                                            value={value}
                                            announceLabel={false}
                                            size='medium'
                                        />
                                    ))}
                                </span>
                            );
                        } else {
                            valueControl = (
                                <span
                                    className='ChannelInfoAttributes__empty'
                                    data-testid={`channelInfoAttributeUnset-${field.name}`}
                                >
                                    <FormattedMessage
                                        id='channel_attributes.info.not_set'
                                        defaultMessage='Not set'
                                    />
                                </span>
                            );
                        }

                        return (
                            <div
                                key={field.id}
                                className='ChannelInfoAttributes__row'
                                data-testid={`channelInfoAttributeRow-${field.name}`}
                            >
                                <span className={isMissing ? 'ChannelInfoAttributes__label ChannelInfoAttributes__label--missing' : 'ChannelInfoAttributes__label'}>
                                    {label}
                                    {locked && (
                                        <LockOutlineIcon
                                            size={12}
                                            data-testid={`channelInfoAttributeLock-${field.name}`}
                                            aria-label={formatMessage(lockReason)}
                                        />
                                    )}
                                </span>

                                <span className='ChannelInfoAttributes__value'>
                                    {valueControl}
                                </span>

                                {failedFieldId === field.id && (
                                    <span
                                        className='ChannelInfoAttributes__error'
                                        role='alert'
                                        data-testid={`channelInfoAttributeError-${field.name}`}
                                    >
                                        {failedAsRequired ? (
                                            <FormattedMessage
                                                id='channel_attributes.info.save_failed_required'
                                                defaultMessage='{label} is required. Choose a value instead of clearing it.'
                                                values={{label}}
                                            />
                                        ) : (
                                            <FormattedMessage
                                                id='channel_attributes.info.save_failed'
                                                defaultMessage="Couldn't save {label}. Try again."
                                                values={{label}}
                                            />
                                        )}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {addableAttributes.length > 0 && (
                    <Menu.Container
                        menuButton={{
                            id: 'channelInfoAddAttributeButton',
                            class: 'ChannelInfoAttributes__add',
                            children: (
                                <>
                                    <PlusIcon size={16}/>
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
        </div>
    );
});

ChannelInfoAttributes.displayName = 'ChannelInfoAttributes';

export default ChannelInfoAttributes;
