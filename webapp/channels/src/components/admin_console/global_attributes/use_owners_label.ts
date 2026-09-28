// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';
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

// The owners' display names, e.g. "SCIM and svc-sync". Empty when there are no owners.
export function useOwnersLabel(owners: PropertyFieldOwner[]): string {
    const {formatList} = useIntl();
    const names = useSelector((state: GlobalState) => owners.map((owner) => {
        return owner.type === 'plugin' ? getPluginDisplayName(state, owner.id) : owner.id;
    }), shallowEqual);

    return formatList(names, {type: 'conjunction'});
}
