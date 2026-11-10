// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

import {PROPERTY_SYNC_SOURCES} from 'mattermost-redux/utils/property_utils';
import type {PropertySyncSource} from 'mattermost-redux/utils/property_utils';

export type ExternalSource = PropertySyncSource;

// Also the order the "Synced with" chips render in, and the order
// resolveExternalSource picks from when more than one source is linked.
export const ALL_EXTERNAL_SOURCES: readonly ExternalSource[] = PROPERTY_SYNC_SOURCES;

// The external attribute (or claim) each source populates the attribute from,
// '' for a source that is not linked.
export type ExternalSourceLinks = Record<ExternalSource, string>;

export const NO_EXTERNAL_SOURCE_LINKS: ExternalSourceLinks = {ldap: '', saml: '', openid: ''};

export function externalSourceLinksFromField(field: Pick<PropertyField, 'attrs'>): ExternalSourceLinks {
    const links = {...NO_EXTERNAL_SOURCE_LINKS};
    for (const source of ALL_EXTERNAL_SOURCES) {
        const value = field.attrs?.[source];
        links[source] = typeof value === 'string' ? value : '';
    }
    return links;
}

export function linkedExternalSources(links: ExternalSourceLinks): ExternalSource[] {
    return ALL_EXTERNAL_SOURCES.filter((source) => links[source]);
}

export function hasExternalSourceLink(links: ExternalSourceLinks): boolean {
    return linkedExternalSources(links).length > 0;
}

// The single source to name on surfaces that have room for only one -- AD/LDAP
// and SAML can be linked at once, in which case the first linked one wins.
export function resolveExternalSource(links: ExternalSourceLinks): ExternalSource | undefined {
    return linkedExternalSources(links)[0];
}

// OpenID Connect users never pass through the AD/LDAP sync, and the server
// resolves an attribute naming several sources to AD/LDAP, so an attribute
// linked to OpenID Connect would never be written for them. The server
// therefore refuses OpenID Connect alongside any other source.
export function sourcesExclusiveOf(source: ExternalSource): ExternalSource[] {
    return ALL_EXTERNAL_SOURCES.filter((other) => other !== source && (other === 'openid' || source === 'openid'));
}

// The linked sources that keep `source` from being linked too.
export function conflictingExternalSources(source: ExternalSource, links: ExternalSourceLinks): ExternalSource[] {
    return sourcesExclusiveOf(source).filter((other) => links[other]);
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
    openid: defineMessages({
        title: {id: 'admin.global_attributes.attribute_details.external_source.openid.title', defaultMessage: 'OpenID Connect'},
        subtitle: {id: 'admin.global_attributes.attribute_details.external_source.openid.subtitle', defaultMessage: 'Map claims at sign-in'},
        modalTitle: {id: 'admin.global_attributes.attribute_details.external_source.openid.modal_title', defaultMessage: 'Link to OpenID Connect'},
        helpText: {
            id: 'admin.global_attributes.attribute_details.external_source.openid.help_text',
            defaultMessage: 'The claim in the ID token or userinfo response to sync this value from, for example department. Use dots for nested claims, such as address.country. If the claim is missing at sign-in, the value is removed.',
        },
    }),
} as const;
