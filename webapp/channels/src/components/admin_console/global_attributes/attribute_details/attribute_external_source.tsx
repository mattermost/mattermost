// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState, type JSX} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {CloseCircleIcon, PencilOutlineIcon, RefreshIcon, SyncIcon} from '@mattermost/compass-icons/components';
import {buttonClassNames} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {openModal} from 'actions/views/modals';

import AttributeModal from 'components/admin_console/system_properties/attribute_modal';
import Divider from 'components/divider/divider';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

import type {ExternalSource, ExternalSourceLinks} from './external_source';
import {ALL_EXTERNAL_SOURCES, conflictingExternalSources, externalSourceMessages as sourceMessages, linkedExternalSources} from './external_source';
import useExternalSourceAvailability from './use_external_source_availability';
import type {ExternalSourceUnavailableReason} from './use_external_source_availability';

import {toServerFieldType} from '../attribute_type';
import type {AttributeTypeId} from '../utils';

import './attribute_external_source.scss';

const TRIGGER_ID = 'attribute-external-source-trigger';

const LINK_MODAL_IDS: Record<ExternalSource, string> = {
    ldap: ModalIdentifiers.ATTRIBUTE_MODAL_LDAP,
    saml: ModalIdentifiers.ATTRIBUTE_MODAL_SAML,
    openid: ModalIdentifiers.ATTRIBUTE_MODAL_OPENID,
};

type Props = {
    links: ExternalSourceLinks;
    fieldType: AttributeTypeId;
    onLink: (source: ExternalSource, value: string) => void;
    disabled?: boolean;

    // Linking a new source to an attribute whose type cannot be synced forces
    // fieldType to 'text' (see attribute_details.tsx's handleLink) -- while this
    // attribute is applied to a resource, that would change its type out from
    // under the server's type_change_with_dependents guard the same way the Type
    // menu itself is locked for. Only gates the "add" trigger below: editing or
    // removing an already-linked source never touches fieldType, so those stay
    // enabled.
    disableAdding?: boolean;
};

function AttributeExternalSource({links, fieldType, onLink, disabled = false, disableAdding = false}: Props): JSX.Element {
    const {formatMessage, formatList} = useIntl();
    const dispatch = useDispatch();
    const unavailable = useExternalSourceAvailability();

    const [statusMessage, setStatusMessage] = useState('');

    const linkedSources = linkedExternalSources(links);
    const unlinkedSources = ALL_EXTERNAL_SOURCES.filter((source) => !links[source]);
    const linkedCount = linkedSources.length;

    // Distinguishes a Type switch clearing link(s) from an admin-driven chip
    // removal -- NOT by how many links were cleared (a Type switch can clear
    // just one, if only one was ever set), but by whether `fieldType` changed
    // along with them: a chip's own remove action never touches it, while a
    // Type switch to a type that cannot be synced changes it in the same batch
    // as clearing the link(s). The switch case needs an explicit announcement
    // (aria-live on a region whose content is merely removed, with nothing
    // left behind, is not reliably announced by screen readers); the
    // chip-removal case needs focus moved to the trigger instead, since the
    // admin's own click already tells them what happened -- moving focus there
    // too would instead steal it from the Type menu they just used.
    const prevCountRef = useRef(linkedCount);
    const prevFieldTypeRef = useRef(fieldType);
    useEffect(() => {
        const prevCount = prevCountRef.current;
        const fieldTypeChanged = fieldType !== prevFieldTypeRef.current;
        prevFieldTypeRef.current = fieldType;
        if (linkedCount < prevCount) {
            if (fieldTypeChanged) {
                setStatusMessage(formatMessage(messages.linksRemoved, {count: prevCount}));
            } else {
                document.getElementById(TRIGGER_ID)?.focus();
            }
        } else if (linkedCount > 0) {
            // Reset so a later, semantically-identical announcement (link
            // again, then switch Type away again) still mutates the DOM --
            // React bails on setting the exact same string twice, and most
            // screen readers only announce a live region on mutation.
            setStatusMessage('');
        }
        prevCountRef.current = linkedCount;
    }, [linkedCount, fieldType, formatMessage]);

    const openLinkModal = useCallback((source: ExternalSource) => {
        dispatch(openModal({
            modalId: LINK_MODAL_IDS[source],
            dialogType: AttributeModal,
            dialogProps: {
                initialValue: links[source],
                fieldType: toServerFieldType(fieldType),
                onExited: () => {},
                onSave: async (value: string) => {
                    onLink(source, value);
                },
                error: null,
                helpText: <FormattedMessage {...sourceMessages[source].helpText}/>,
                modalHeaderText: <FormattedMessage {...sourceMessages[source].modalTitle}/>,
            },
        }));
    }, [dispatch, fieldType, links, onLink]);

    // Closing the link modal restores focus to the trigger programmatically,
    // and it comes from a keyboard-focused control (a text input always matches
    // :focus-visible, and Enter submits from there), so the trigger inherits
    // :focus-visible. Clicking it with the mouse does not clear that -- an
    // already-focused element fires no new focus event -- so the item MUI
    // auto-focuses on open inherits it in turn and gets painted with the
    // keyboard focus ring, on a menu the admin opened with the mouse. Dropping
    // focus on press lets the click's own default focus re-evaluate the
    // interaction as a pointer one; keyboard opens never fire mousedown, so
    // their focus ring is untouched.
    const handleTriggerMouseDown = useCallback((event: React.MouseEvent<HTMLElement>) => {
        const trigger = event.currentTarget;
        if (document.activeElement !== trigger) {
            return;
        }

        try {
            if (trigger.matches(':focus-visible')) {
                trigger.blur();
            }
        } catch {
            // :focus-visible is unsupported (jsdom) -- there is no state to clear.
        }
    }, []);

    // A source that cannot be linked right now stays listed, disabled, with the
    // reason as its second line -- so it reads without hovering -- and spelled
    // out in a tooltip.
    const renderSourceItem = (source: ExternalSource) => {
        const conflicts = conflictingExternalSources(source, links);
        const reason = unavailable[source];
        const blocked = conflicts.length > 0 || Boolean(reason);
        const sourceTitle = formatMessage(sourceMessages[source].title);

        let blockedLabel = '';
        let blockedTooltip = '';
        if (conflicts.length > 0) {
            const linkedTitles = formatList(conflicts.map((other) => formatMessage(sourceMessages[other].title)), {type: 'conjunction'});
            blockedLabel = formatMessage(messages.conflictLabel, {sources: linkedTitles});
            blockedTooltip = formatMessage(messages.conflictTooltip, {source: sourceTitle, sources: linkedTitles, count: conflicts.length});
        } else if (reason) {
            blockedLabel = formatMessage(UNAVAILABLE_MESSAGES[reason].label, {source: sourceTitle});
            blockedTooltip = formatMessage(UNAVAILABLE_MESSAGES[reason].tooltip, {source: sourceTitle});
        }

        const item = (
            <Menu.Item
                id={`attribute-external-source-${source}`}
                key={source}
                leadingElement={<SyncIcon size={18}/>}
                onClick={() => openLinkModal(source)}
                disabled={blocked}
                labels={(
                    <>
                        <FormattedMessage {...sourceMessages[source].title}/>
                        {blocked ? <span>{blockedLabel}</span> : <FormattedMessage {...sourceMessages[source].subtitle}/>}
                    </>
                )}
            />
        );

        if (!blocked) {
            return item;
        }

        // Beside the item rather than above or below it, so the tooltip never
        // covers a neighbouring entry the admin may want next.
        return (
            <WithTooltip
                key={source}
                title={blockedTooltip}
                isVertical={false}
            >
                <div data-testid={`attributeExternalSourceBlocked-${source}`}>
                    {item}
                </div>
            </WithTooltip>
        );
    };

    return (
        <div
            className='AttributeExternalSource'
            data-testid='attributeExternalSource'
        >
            {linkedSources.length === 0 && (
                <Divider className='AttributeExternalSource__divider'/>
            )}
            {linkedSources.length > 0 && (
                <div
                    className='AttributeExternalSource__synced'
                    data-testid='attributeExternalSourceSynced'
                >
                    <span className='AttributeExternalSource__syncedLabel'>
                        <FormattedMessage {...messages.syncedWith}/>
                    </span>
                    <div className='AttributeExternalSource__chips'>
                        {linkedSources.map((source) => (
                            <ExternalSourceChip
                                key={source}
                                source={source}
                                value={links[source]}
                                onEdit={() => openLinkModal(source)}
                                onRemove={() => onLink(source, '')}
                                disabled={disabled}
                            />
                        ))}
                    </div>
                </div>
            )}
            {unlinkedSources.length > 0 && (
                (() => {
                    const trigger = (
                        <Menu.Container
                            menuButton={{
                                id: TRIGGER_ID,
                                class: classNames(buttonClassNames({emphasis: 'quaternary'}), 'AttributeExternalSource__trigger'),
                                disabled: disabled || disableAdding,
                                onMouseDown: handleTriggerMouseDown,
                                children: (
                                    <>
                                        <RefreshIcon size={16}/>
                                        <FormattedMessage {...messages.triggerLabel}/>
                                        <i className='icon icon-chevron-down'/>
                                    </>
                                ),
                                dataTestId: 'attributeExternalSourceTrigger',
                            }}
                            menu={{
                                id: 'attribute-external-source-menu',
                                'aria-label': formatMessage(messages.triggerLabel),
                            }}
                        >
                            {unlinkedSources.map(renderSourceItem)}
                        </Menu.Container>
                    );
                    return disableAdding ? (
                        <WithTooltip title={formatMessage(messages.disabledWhileAppliesToTooltip)}>
                            <span
                                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WithTooltip's useFocus only fires on its cloned child; without this the disabled trigger is unreachable by keyboard, so the tooltip explaining the lock is mouse-only
                                tabIndex={0}
                                className='AttributeExternalSource__triggerLockWrap'
                                data-testid='attributeExternalSourceTriggerLockWrap'
                            >
                                {trigger}
                            </span>
                        </WithTooltip>
                    ) : trigger;
                })()
            )}
            <span
                role='status'
                className='sr-only'
                data-testid='attributeExternalSourceStatus'
            >
                {statusMessage}
            </span>
        </div>
    );
}

type ExternalSourceChipProps = {
    source: ExternalSource;
    value: string;
    onEdit: () => void;
    onRemove: () => void;
    disabled?: boolean;
};

function ExternalSourceChip({source, value, onEdit, onRemove, disabled = false}: ExternalSourceChipProps): JSX.Element {
    const {formatMessage} = useIntl();

    const sourceTitle = formatMessage(sourceMessages[source].title);
    const editLabel = formatMessage(messages.editLink, {source: sourceTitle});
    const removeLabel = formatMessage(messages.removeLink, {source: sourceTitle});

    return (
        <span
            className='AttributeExternalSource__chip'
            data-testid={`attributeExternalSourceChip-${source}`}
        >
            <SyncIcon size={16}/>
            <span className='AttributeExternalSource__chipLabel'>
                {formatMessage(messages.chipLabel, {source: sourceTitle, value})}
            </span>
            <button
                type='button'
                className='AttributeExternalSource__chipAction'
                data-testid={`attributeExternalSourceChip-${source}-edit`}
                onClick={onEdit}
                disabled={disabled}
                aria-label={editLabel}
            >
                <PencilOutlineIcon size={14}/>
            </button>
            <button
                type='button'
                className='AttributeExternalSource__chipAction'
                data-testid={`attributeExternalSourceChip-${source}-remove`}
                onClick={onRemove}
                disabled={disabled}
                aria-label={removeLabel}
            >
                <CloseCircleIcon
                    size={12}
                    aria-hidden={true}
                />
            </button>
        </span>
    );
}

export default AttributeExternalSource;

const messages = defineMessages({
    triggerLabel: {id: 'admin.global_attributes.attribute_details.external_source.trigger_label', defaultMessage: 'Link to external source'},
    syncedWith: {id: 'admin.global_attributes.attribute_details.external_source.synced_with', defaultMessage: 'Synced with'},
    editLink: {id: 'admin.global_attributes.attribute_details.external_source.edit_link', defaultMessage: 'Edit {source} link'},
    removeLink: {id: 'admin.global_attributes.attribute_details.external_source.remove_link', defaultMessage: 'Remove {source} link'},
    chipLabel: {id: 'admin.global_attributes.attribute_details.external_source.chip_label', defaultMessage: '{source}: {value}'},
    linksRemoved: {
        id: 'admin.global_attributes.attribute_details.external_source.links_removed',
        defaultMessage: '{count, plural, one {External source link removed} other {External source links removed}}',
    },
    disabledWhileAppliesToTooltip: {
        id: 'admin.global_attributes.attribute_details.external_source.disabled_applies_to_tooltip',
        defaultMessage: 'Cannot link an external source while this attribute applies to a resource.',
    },
    conflictLabel: {
        id: 'admin.global_attributes.attribute_details.external_source.conflict_label',
        defaultMessage: 'Can\'t be combined with {sources}',
    },
    conflictTooltip: {
        id: 'admin.global_attributes.attribute_details.external_source.conflict_tooltip',
        defaultMessage: 'An attribute synced from OpenID Connect can\'t also sync from AD/LDAP or SAML. Remove the {sources} {count, plural, one {link} other {links}} to link {source}.',
    },
    flagOffLabel: {
        id: 'admin.global_attributes.attribute_details.external_source.unavailable.flag_off.label',
        defaultMessage: 'Turned off on this server',
    },
    flagOffTooltip: {
        id: 'admin.global_attributes.attribute_details.external_source.unavailable.flag_off.tooltip',
        defaultMessage: 'Syncing attributes from {source} is turned off on this server.',
    },
    unlicensedLabel: {
        id: 'admin.global_attributes.attribute_details.external_source.unavailable.unlicensed.label',
        defaultMessage: 'Not included in your license',
    },
    unlicensedTooltip: {
        id: 'admin.global_attributes.attribute_details.external_source.unavailable.unlicensed.tooltip',
        defaultMessage: 'Your license doesn\'t include {source}.',
    },
    notEnabledLabel: {
        id: 'admin.global_attributes.attribute_details.external_source.unavailable.not_enabled.label',
        defaultMessage: 'Set up {source} first',
    },
    notEnabledTooltip: {
        id: 'admin.global_attributes.attribute_details.external_source.unavailable.not_enabled.tooltip',
        defaultMessage: 'Turn on {source} in System Console > Authentication > {source} to link attributes to its claims.',
    },
});

const UNAVAILABLE_MESSAGES: Record<ExternalSourceUnavailableReason, {label: MessageDescriptor; tooltip: MessageDescriptor}> = {
    flag_off: {label: messages.flagOffLabel, tooltip: messages.flagOffTooltip},
    unlicensed: {label: messages.unlicensedLabel, tooltip: messages.unlicensedTooltip},
    not_enabled: {label: messages.notEnabledLabel, tooltip: messages.notEnabledTooltip},
};

