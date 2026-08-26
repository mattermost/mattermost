// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import {components} from 'react-select';

import {PencilOutlineIcon, RefreshIcon, SyncIcon} from '@mattermost/compass-icons/components';
import {buttonClassNames} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {openModal} from 'actions/views/modals';

import AttributeModal from 'components/admin_console/system_properties/attribute_modal';
import Divider from 'components/divider/divider';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

import type {AttributeFieldType} from '../utils';

import './attribute_external_source.scss';

export type ExternalSource = 'ldap' | 'saml';

const ALL_SOURCES: ExternalSource[] = ['ldap', 'saml'];

const TRIGGER_ID = 'attribute-external-source-trigger';

type Props = {
    ldapAttr: string;
    samlAttr: string;
    fieldType: AttributeFieldType;
    onLink: (source: ExternalSource, value: string) => void;
    disabled?: boolean;

    // Linking a new source forces fieldType to 'text' (see attribute_details.tsx's
    // handleLink) -- while this attribute is applied to a resource, that would
    // change its type out from under the server's type_change_with_dependents
    // guard the same way the Type menu itself is locked for. Only gates the
    // "add" trigger below: editing or removing an already-linked source never
    // touches fieldType, so those stay enabled.
    disableAdding?: boolean;
};

function sourceValue(source: ExternalSource, ldapAttr: string, samlAttr: string): string {
    return source === 'ldap' ? ldapAttr : samlAttr;
}

function AttributeExternalSource({ldapAttr, samlAttr, fieldType, onLink, disabled = false, disableAdding = false}: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [statusMessage, setStatusMessage] = useState('');

    const linkedCount = (ldapAttr ? 1 : 0) + (samlAttr ? 1 : 0);

    // Distinguishes a Type switch clearing link(s) from an admin-driven chip
    // removal -- NOT by how many links were cleared (a Type switch can clear
    // just one, if only one was ever set), but by `fieldType`: linking always
    // forces it to 'text' (see attribute_details.tsx's handleLink), and a
    // chip's own remove action never touches it, so fieldType stays 'text'
    // through any chip-driven removal; a Type switch always changes it in the
    // same batch as clearing the link(s). The switch case needs an explicit
    // announcement (aria-live on a region whose content is merely removed,
    // with nothing left behind, is not reliably announced by screen readers);
    // the chip-removal case needs focus moved to the trigger instead, since
    // the admin's own click already tells them what happened -- moving focus
    // there too would instead steal it from the Type menu they just used.
    const prevCountRef = useRef(linkedCount);
    useEffect(() => {
        const prevCount = prevCountRef.current;
        if (linkedCount < prevCount) {
            if (fieldType === 'text') {
                document.getElementById(TRIGGER_ID)?.focus();
            } else {
                setStatusMessage(formatMessage(messages.linksRemoved, {count: prevCount}));
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
            modalId: source === 'ldap' ? ModalIdentifiers.ATTRIBUTE_MODAL_LDAP : ModalIdentifiers.ATTRIBUTE_MODAL_SAML,
            dialogType: AttributeModal,
            dialogProps: {
                initialValue: sourceValue(source, ldapAttr, samlAttr),
                fieldType,
                onExited: () => {},
                onSave: async (value: string) => {
                    onLink(source, value);
                },
                error: null,
                helpText: <FormattedMessage {...sourceMessages[source].helpText}/>,
                modalHeaderText: <FormattedMessage {...sourceMessages[source].modalTitle}/>,
            },
        }));
    }, [dispatch, fieldType, ldapAttr, samlAttr, onLink]);

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

    const linkedSources = ALL_SOURCES.filter((source) => sourceValue(source, ldapAttr, samlAttr));
    const unlinkedSources = ALL_SOURCES.filter((source) => !sourceValue(source, ldapAttr, samlAttr));

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
                                value={sourceValue(source, ldapAttr, samlAttr)}
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
                            {unlinkedSources.map((source) => (
                                <Menu.Item
                                    id={`attribute-external-source-${source}`}
                                    key={source}
                                    leadingElement={<SyncIcon size={18}/>}
                                    onClick={() => openLinkModal(source)}
                                    labels={(
                                        <>
                                            <FormattedMessage {...sourceMessages[source].title}/>
                                            <FormattedMessage {...sourceMessages[source].subtitle}/>
                                        </>
                                    )}
                                />
                            ))}
                        </Menu.Container>
                    );
                    return disableAdding ? (
                        <WithTooltip title={formatMessage(messages.disabledWhileAppliesToTooltip)}>
                            <span data-testid='attributeExternalSourceTriggerLockWrap'>
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
                <components.CrossIcon size={14}/>
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
});

const sourceMessages = {
    ldap: defineMessages({
        title: {id: 'admin.global_attributes.attribute_details.external_source.ldap.title', defaultMessage: 'AD/LDAP'},
        subtitle: {id: 'admin.global_attributes.attribute_details.external_source.ldap.subtitle', defaultMessage: 'Sync with your directory of record'},
        modalTitle: {id: 'admin.global_attributes.attribute_details.external_source.ldap.modal_title', defaultMessage: 'Link to AD/LDAP'},
        helpText: {id: 'admin.global_attributes.attribute_details.external_source.ldap.help_text', defaultMessage: 'The attribute in your AD/LDAP directory to sync this value from.'},
    }),
    saml: defineMessages({
        title: {id: 'admin.global_attributes.attribute_details.external_source.saml.title', defaultMessage: 'SAML'},
        subtitle: {id: 'admin.global_attributes.attribute_details.external_source.saml.subtitle', defaultMessage: 'Map values from SAML at sign-in'},
        modalTitle: {id: 'admin.global_attributes.attribute_details.external_source.saml.modal_title', defaultMessage: 'Link to SAML'},
        helpText: {id: 'admin.global_attributes.attribute_details.external_source.saml.help_text', defaultMessage: 'The attribute in your SAML response to sync this value from.'},
    }),
} as const;
