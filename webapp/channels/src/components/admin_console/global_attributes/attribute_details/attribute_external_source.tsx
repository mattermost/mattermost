// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import {components} from 'react-select';

import {PencilOutlineIcon, RefreshIcon, SyncIcon} from '@mattermost/compass-icons/components';
import {buttonClassNames} from '@mattermost/shared/components/button';

import {openModal} from 'actions/views/modals';

import AttributeModal from 'components/admin_console/system_properties/attribute_modal';
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
};

function sourceValue(source: ExternalSource, ldapAttr: string, samlAttr: string): string {
    return source === 'ldap' ? ldapAttr : samlAttr;
}

function AttributeExternalSource({ldapAttr, samlAttr, fieldType, onLink}: Props): JSX.Element {
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

    const linkedSources = ALL_SOURCES.filter((source) => sourceValue(source, ldapAttr, samlAttr));
    const unlinkedSources = ALL_SOURCES.filter((source) => !sourceValue(source, ldapAttr, samlAttr));

    return (
        <div
            className='AttributeExternalSource'
            data-testid='attributeExternalSource'
        >
            {linkedSources.length > 0 && (
                <div className='AttributeExternalSource__chips'>
                    {linkedSources.map((source) => (
                        <ExternalSourceChip
                            key={source}
                            source={source}
                            onEdit={() => openLinkModal(source)}
                            onRemove={() => onLink(source, '')}
                        />
                    ))}
                </div>
            )}
            {unlinkedSources.length > 0 && (
                <Menu.Container
                    menuButton={{
                        id: TRIGGER_ID,
                        class: classNames(buttonClassNames({emphasis: 'quaternary'}), 'AttributeExternalSource__trigger'),
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
    onEdit: () => void;
    onRemove: () => void;
};

function ExternalSourceChip({source, onEdit, onRemove}: ExternalSourceChipProps): JSX.Element {
    const {formatMessage} = useIntl();

    const editLabel = formatMessage(messages.editLink, {source: formatMessage(sourceMessages[source].title)});
    const removeLabel = formatMessage(messages.removeLink, {source: formatMessage(sourceMessages[source].title)});

    return (
        <span
            className='AttributeExternalSource__chip'
            data-testid={`attributeExternalSourceChip-${source}`}
        >
            <SyncIcon size={16}/>
            <span className='AttributeExternalSource__chipLabel'>
                <FormattedMessage {...sourceMessages[source].title}/>
            </span>
            <button
                type='button'
                className='AttributeExternalSource__chipAction'
                data-testid={`attributeExternalSourceChip-${source}-edit`}
                onClick={onEdit}
                aria-label={editLabel}
            >
                <PencilOutlineIcon size={14}/>
            </button>
            <button
                type='button'
                className='AttributeExternalSource__chipAction'
                data-testid={`attributeExternalSourceChip-${source}-remove`}
                onClick={onRemove}
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
    editLink: {id: 'admin.global_attributes.attribute_details.external_source.edit_link', defaultMessage: 'Edit {source} link'},
    removeLink: {id: 'admin.global_attributes.attribute_details.external_source.remove_link', defaultMessage: 'Remove {source} link'},
    linksRemoved: {
        id: 'admin.global_attributes.attribute_details.external_source.links_removed',
        defaultMessage: '{count, plural, one {External source link removed} other {External source links removed}}',
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
