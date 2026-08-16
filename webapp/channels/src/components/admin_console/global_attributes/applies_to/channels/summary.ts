// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape, MessageDescriptor} from 'react-intl';
import {defineMessages} from 'react-intl';

import type {PropertyPermissionLevel} from '@mattermost/types/properties';

import {DISPLAY_BANNER_TOP, DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO} from 'mattermost-redux/constants/properties';

import type {ChannelDisplayLocation, ChannelResourceConfig} from './types';

export const locationMessages = defineMessages({
    [DISPLAY_LABEL_HEADER]: {id: 'admin.global_attributes.applies_to.channels.location.header', defaultMessage: 'Header'},
    [DISPLAY_LABEL_INFO]: {id: 'admin.global_attributes.applies_to.channels.location.sidebar', defaultMessage: 'Sidebar'},
    [DISPLAY_BANNER_TOP]: {id: 'admin.global_attributes.applies_to.channels.location.banner', defaultMessage: 'Banner'},
});

export const setterMessages = defineMessages({
    member: {id: 'admin.global_attributes.applies_to.channels.setter.member', defaultMessage: 'Any member'},
    admin: {id: 'admin.global_attributes.applies_to.channels.setter.admin', defaultMessage: 'Channel admin'},
    sysadmin: {id: 'admin.global_attributes.applies_to.channels.setter.sysadmin', defaultMessage: 'System admin'},
    none: {id: 'admin.global_attributes.applies_to.channels.setter.none', defaultMessage: 'Nobody'},
});

// The row offers two tiers, but a field configured through the API can carry any
// of the four, so every level stays describable rather than rendering undefined.
export function setterLabelFor(permissionValues: PropertyPermissionLevel): MessageDescriptor {
    return setterMessages[permissionValues as keyof typeof setterMessages] ?? setterMessages.admin;
}

const messages = defineMessages({
    required: {id: 'admin.global_attributes.applies_to.channels.summary.required', defaultMessage: 'Required'},
    optional: {id: 'admin.global_attributes.applies_to.channels.summary.optional', defaultMessage: 'Optional'},
    display: {id: 'admin.global_attributes.applies_to.channels.summary.display', defaultMessage: 'Display: {locations}'},
    hidden: {id: 'admin.global_attributes.applies_to.channels.summary.hidden', defaultMessage: 'Not displayed'},
    setBy: {id: 'admin.global_attributes.applies_to.channels.summary.set_by', defaultMessage: 'Set by {setter}'},
    locked: {id: 'admin.global_attributes.applies_to.channels.summary.locked', defaultMessage: 'Locked once set'},
});

export function displayLocationLabel(location: ChannelDisplayLocation, intl: IntlShape): string {
    return intl.formatMessage(locationMessages[location]);
}

/**
 * The collapsed one-liner, e.g. "Optional · Display: Header + Sidebar · Set by
 * Channel admin". Assembled from short conditional segments rather than one
 * message with five optional slots, which translators cannot work with.
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

    segments.push(intl.formatMessage(messages.setBy, {
        setter: intl.formatMessage(setterLabelFor(config.permissionValues)),
    }));

    if (!config.editable) {
        segments.push(intl.formatMessage(messages.locked));
    }

    return segments.join(' · ');
}
