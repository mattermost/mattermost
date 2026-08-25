// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentType} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessages} from 'react-intl';

import {AccountOutlineIcon, MessageTextOutlineIcon, ProductChannelsIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';

import type {ChannelResourceConfig} from '../applies_to/channels/types';

export type ResourceObjectType = 'user' | 'channel' | 'post';

// Fixed Users -> Channels -> Posts order used everywhere a resource list is
// rendered (the picker menu, and used to derive "available" options) -- not
// the insertion order of a saved appliesTo array, which is separate.
export const ALL_RESOURCE_TYPES: ResourceObjectType[] = ['user', 'channel', 'post'];

// Every per-resource-type row component (AttributeAppliesToUserItem/
// ChannelItem/PostItem) implements exactly this prop signature -- there's no
// resourceType prop, since each component already knows its own type. Sharing
// one type here (rather than each component declaring an identical local
// `Props`) is what AttributeAppliesTo relies on to treat all three
// interchangeably in its render switch.
export type AttributeAppliesToItemProps = {
    disabled?: boolean;
    onRemove: () => void;
};

// Channels is the one resource with settings of its own, so its row takes the
// shared props plus the configuration it edits. The page owns that state: it is
// what the linked channel field is built from at save time.
export type AttributeAppliesToChannelItemProps = AttributeAppliesToItemProps & {
    config: ChannelResourceConfig;
    onConfigChange: (next: ChannelResourceConfig) => void;

    // Whether the attribute is rank-typed, which is what makes the directional
    // change policies meaningful.
    ordered?: boolean;
};

// Shared between AttributeAppliesTo (which owns the button) and AttributeDetails
// (which moves focus back to it after a pre-save resource removal).
export const ATTRIBUTE_APPLIES_TO_ADD_HEADER_TRIGGER_ID = 'attribute-applies-to-add-header';

export const RESOURCE_TYPE_ICONS: Record<ResourceObjectType, ComponentType<IconProps>> = {
    user: AccountOutlineIcon,
    channel: ProductChannelsIcon,
    post: MessageTextOutlineIcon,
};

export const resourceTypeLabels: Record<ResourceObjectType, MessageDescriptor> = defineMessages({
    user: {id: 'admin.global_attributes.attribute_details.applies_to.resource_type.user', defaultMessage: 'Users'},
    channel: {id: 'admin.global_attributes.attribute_details.applies_to.resource_type.channel', defaultMessage: 'Channels'},
    post: {id: 'admin.global_attributes.attribute_details.applies_to.resource_type.post', defaultMessage: 'Posts'},
});
