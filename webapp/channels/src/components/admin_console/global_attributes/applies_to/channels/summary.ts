// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape, MessageDescriptor} from 'react-intl';
import {defineMessages} from 'react-intl';

import {DISPLAY_BANNER_TOP, DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO} from 'mattermost-redux/constants/properties';

import type {ChannelChangePolicy, ChannelDisplayLocation, ChannelResourceConfig} from './types';

export const locationMessages = defineMessages({
    [DISPLAY_LABEL_HEADER]: {id: 'admin.global_attributes.applies_to.channels.location.header', defaultMessage: 'Header'},
    [DISPLAY_LABEL_INFO]: {id: 'admin.global_attributes.applies_to.channels.location.info', defaultMessage: 'Channel Info'},
    [DISPLAY_BANNER_TOP]: {id: 'admin.global_attributes.applies_to.channels.location.banner', defaultMessage: 'Banner'},
});

export const changePolicyMessages = defineMessages({
    any: {id: 'admin.global_attributes.applies_to.channels.change_policy.any', defaultMessage: 'Can be changed at any time'},
    raise_only: {id: 'admin.global_attributes.applies_to.channels.change_policy.raise_only', defaultMessage: 'Can only be raised, never lowered'},
    lower_only: {id: 'admin.global_attributes.applies_to.channels.change_policy.lower_only', defaultMessage: 'Can only be lowered, never raised'},
    never: {id: 'admin.global_attributes.applies_to.channels.change_policy.never', defaultMessage: 'Cannot be changed once set'},
});

export function changePolicyLabelFor(policy: ChannelChangePolicy): MessageDescriptor {
    return changePolicyMessages[policy] ?? changePolicyMessages.any;
}

const summaryChangePolicyMessages = defineMessages({
    raise_only: {id: 'admin.global_attributes.applies_to.channels.summary.raise_only', defaultMessage: 'Raise only'},
    lower_only: {id: 'admin.global_attributes.applies_to.channels.summary.lower_only', defaultMessage: 'Lower only'},
    never: {id: 'admin.global_attributes.applies_to.channels.summary.never', defaultMessage: 'Locked once set'},
});

const messages = defineMessages({
    required: {id: 'admin.global_attributes.applies_to.channels.summary.required', defaultMessage: 'Required'},
    optional: {id: 'admin.global_attributes.applies_to.channels.summary.optional', defaultMessage: 'Optional'},
    display: {id: 'admin.global_attributes.applies_to.channels.summary.display', defaultMessage: 'Display: {locations}'},
    hidden: {id: 'admin.global_attributes.applies_to.channels.summary.hidden', defaultMessage: 'Not displayed'},
});

export function displayLocationLabel(location: ChannelDisplayLocation, intl: IntlShape): string {
    return intl.formatMessage(locationMessages[location]);
}

/**
 * The collapsed one-liner, e.g. "Optional · Display: Header + Channel Info".
 * Assembled from short conditional segments rather than one message with four
 * optional slots, which translators cannot work with.
 */
export function summarizeChannelResource(config: ChannelResourceConfig, intl: IntlShape): string {
    const segments: string[] = [
        intl.formatMessage(config.required ? messages.required : messages.optional),
    ];

    if (config.displayLocations.length > 0) {
        const locations = config.displayLocations.
            map((location) => displayLocationLabel(location, intl)).
            join(' + ');
        segments.push(intl.formatMessage(messages.display, {locations}));
    } else {
        segments.push(intl.formatMessage(messages.hidden));
    }

    const policySegment = summaryChangePolicyMessages[config.changePolicy as keyof typeof summaryChangePolicyMessages];
    if (policySegment) {
        segments.push(intl.formatMessage(policySegment));
    }

    return segments.join(' · ');
}
