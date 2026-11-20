// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getLicense, isChannelAttributesEnabled, isPostAttributesEnabled} from 'mattermost-redux/selectors/entities/general';

import {isMinimumEnterpriseAdvancedLicense} from 'utils/license_utils';

import {ALL_RESOURCE_TYPES} from './attribute_details/attribute_applies_to_constants';
import type {ResourceObjectType} from './attribute_details/attribute_applies_to_constants';

// The Applies-to resources this server offers, in the fixed Users -> Channels ->
// Posts order. Shared by the listing table and the details page so both pages
// offer, fetch, and display exactly the same set.
//
// Global Attributes is Enterprise, but a channel attribute is refused below
// Enterprise Advanced (the server 501s a channel-scoped access_control
// request), so Channels needs the licence as well as its flag. Posts is gated
// on PostAttributes alone: the resource is not finished yet, so it must not be
// offered until the flag is on.
export default function useAllowedResourceTypes(): ResourceObjectType[] {
    const channelAttributesEnabled = useSelector((state: GlobalState) =>
        isChannelAttributesEnabled(state) && isMinimumEnterpriseAdvancedLicense(getLicense(state)));
    const postAttributesEnabled = useSelector(isPostAttributesEnabled);

    return useMemo(() => ALL_RESOURCE_TYPES.filter((type) => {
        switch (type) {
        case 'channel':
            return channelAttributesEnabled;
        case 'post':
            return postAttributesEnabled;
        default:
            return true;
        }
    }), [channelAttributesEnabled, postAttributesEnabled]);
}
