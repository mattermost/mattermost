// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages, useIntl} from 'react-intl';
import {shallowEqual, useSelector} from 'react-redux';

import type {PropertyField} from '@mattermost/types/properties';
import type {PropertyFieldOwner} from '@mattermost/types/properties_user';

import {getPluginDisplayName} from 'selectors/plugins';

import type {GlobalState} from 'types/store';

export const NO_OWNERS: PropertyFieldOwner[] = [];

export function getFieldOwners(field: Pick<PropertyField, 'attrs'>): PropertyFieldOwner[] {
    const owners = field.attrs?.owners;
    return Array.isArray(owners) && owners.length > 0 ? owners as PropertyFieldOwner[] : NO_OWNERS;
}

const messages = defineMessages({
    scopedOwner: {id: 'admin.global_attributes.owners.scoped', defaultMessage: '{owner}: {scopes}'},
});

// The owners' display names, e.g. "SCIM and svc-sync", or with scopes "SCIM: local and svc-sync".
// Empty when there are no owners.
export function useOwnersLabel(owners: PropertyFieldOwner[], {withScopes = false} = {}): string {
    const {formatList, formatMessage} = useIntl();
    const names = useSelector((state: GlobalState) => owners.map((owner) => {
        return owner.type === 'plugin' ? getPluginDisplayName(state, owner.id) : owner.id;
    }), shallowEqual);

    const labels = withScopes ? names.map((name, i) => {
        const scopes = owners[i].scopes;
        return scopes?.length ? formatMessage(messages.scopedOwner, {owner: name, scopes: scopes.join(', ')}) : name;
    }) : names;

    return formatList(labels, {type: 'conjunction'});
}
