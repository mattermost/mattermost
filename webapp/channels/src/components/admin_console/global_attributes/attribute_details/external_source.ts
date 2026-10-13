// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

export type ExternalSource = 'ldap' | 'saml';

// Also the order the "Synced with" chips render in, and the order
// resolveExternalSource picks from when both sources are linked.
export const ALL_EXTERNAL_SOURCES: ExternalSource[] = ['ldap', 'saml'];

export function externalSourceValue(source: ExternalSource, ldapAttr: string, samlAttr: string): string {
    return source === 'ldap' ? ldapAttr : samlAttr;
}

// The single source to name on surfaces that have room for only one -- both
// can be linked at once, in which case the first linked one wins.
export function resolveExternalSource(ldapAttr: string, samlAttr: string): ExternalSource | undefined {
    return ALL_EXTERNAL_SOURCES.find((source) => externalSourceValue(source, ldapAttr, samlAttr));
}

export const externalSourceMessages = {
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
