// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import {isTextField, supportsHierarchy, supportsOptions} from '@mattermost/types/properties';
import type {PropertyField} from '@mattermost/types/properties';

import {isChannelAttributesRequiredEnabled} from 'mattermost-redux/selectors/entities/general';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {isPropertyFieldRequired} from 'mattermost-redux/utils/property_utils';

import {hasEditor} from 'components/channel_attributes/channel_attribute_editor_support';

import useCanSetChannelAttributes from './useCanSetChannelAttributes';
import useChannelAttributes from './useChannelAttributes';
import useClassificationMarkings from './useClassificationMarkings';
import useMissingRequiredChannelAttributes from './useMissingRequiredChannelAttributes';

export type RequiredChannelAttributesToAsk = {

    /** The fields to put in front of the person, in definition order. */
    fields: PropertyField[];

    /**
     * Required fields still missing on an existing channel that the person cannot
     * fill (or that have no editor). Always empty without a channelId.
     */
    cannotSet: PropertyField[];

    /**
     * Channel attributes are usable at all. With a channelId this also requires
     * ChannelAttributesRequired, since nothing is asked without it.
     */
    enabled: boolean;

    /** Definitions (and, with a channelId, the channel's values) are still loading. */
    loading: boolean;
};

export type RequiredChannelAttributesScope = {

    /**
     * The team the channel will live in. The setter tiers are not team-specific
     * yet, so nothing reads it; callers pass it so that can change without
     * touching them.
     */
    teamId: string;
    channelId?: string;
};

export type RequiredChannelAttributesOptions = {

    /**
     * Ask only for attributes that are enforced as required. While
     * ChannelAttributesRequired is off nothing is fetched at all (no field
     * definitions, no classification), and nothing is reported as loading.
     * For dialogs that never offered attributes before the Required flag.
     */
    requiredOnly?: boolean;

    /**
     * Fetch and ask nothing, for a dialog that stays mounted while closed.
     */
    skip?: boolean;
};

const NONE: PropertyField[] = [];

/**
 * The required channel attributes to ask the person for before an action.
 *
 * Without a channelId (a channel about to be created, or a group message about to
 * become one) that is every required field they can set on a new channel. The
 * setter tier cannot be evaluated without a channel, so this renders optimistically
 * and the server stays authoritative. sysadmin is the exception: a required
 * sysadmin-only attribute would block everyone else, which is a worse failure than
 * an unset marking -- the server skips the same tier for the same reason.
 *
 * With a channelId only the required fields still missing on that channel are
 * considered (values are fetched fresh). Those the person can set and
 * that have an editor are `fields`; the rest are `cannotSet`.
 *
 * Fields are empty while ChannelAttributesRequired or the license is off, apart
 * from the classification courtesy exception on the no-channel path.
 */
export default function useRequiredChannelAttributesToAsk({channelId}: RequiredChannelAttributesScope, {requiredOnly = false, skip = false}: RequiredChannelAttributesOptions = {}): RequiredChannelAttributesToAsk {
    const isSystemAdmin = useSelector(isCurrentUserSystemAdmin);
    const requiredAttributesEnforced = useSelector(isChannelAttributesRequiredEnabled);
    const skipUnenforced = skip || (requiredOnly && !requiredAttributesEnforced);
    const classification = useClassificationMarkings({skipFetch: skipUnenforced});
    const channelAttributes = useChannelAttributes({skip: skipUnenforced});

    // A fresh value fetch: these are confirmation dialogs, and a cached
    // "complete" channel would skip the fields and be refused by the server.
    const forChannel = Boolean(channelId);
    const missingState = useMissingRequiredChannelAttributes(channelId ?? '', {skip: !forChannel || skipUnenforced});
    const canSet = useCanSetChannelAttributes(channelId ?? '');

    const classificationFieldId = classification.channelField?.id;

    // While ChannelAttributes is on but ChannelAttributesRequired is off,
    // the System Console hides the Required toggle for channel fields entirely,
    // so there is no admin path left to freshly mark one required during that
    // window. Classification is the one courtesy exception: it is still offered
    // for a new channel unconditionally, so admins can keep classifying channels
    // even though nothing enforces it -- every other channel attribute stays hidden.
    const classificationOfferedUnconditionally = channelAttributes.enabled && !requiredAttributesEnforced && classification.available;

    const newChannelFields = useMemo(() => {
        if (forChannel) {
            return NONE;
        }
        return channelAttributes.fields.
            filter((field) => {
                const isClassificationException = field.id === classificationFieldId && classificationOfferedUnconditionally;
                if (!isClassificationException && (!requiredAttributesEnforced || !isPropertyFieldRequired(field))) {
                    return false;
                }
                if (!supportsOptions(field) && !supportsHierarchy(field) && !isTextField(field)) {
                    return false;
                }
                if (field.permission_values === 'none' || field.permission_values === undefined) {
                    return false;
                }
                if (field.permission_values === 'sysadmin' && !isSystemAdmin) {
                    return false;
                }
                return true;
            }).
            map((field) => {
                // Visually optional and never blocking: nothing enforces this
                // value when ChannelAttributesRequired is off, so the required
                // marker would be misleading.
                if (field.id === classificationFieldId && classificationOfferedUnconditionally && isPropertyFieldRequired(field)) {
                    return {...field, attrs: {...field.attrs, required: false}};
                }
                return field;
            });
    }, [forChannel, channelAttributes.fields, classificationFieldId, classificationOfferedUnconditionally, isSystemAdmin, requiredAttributesEnforced]);

    const existingChannel = useMemo(() => {
        const fields: PropertyField[] = [];
        const cannotSet: PropertyField[] = [];
        if (!forChannel || !requiredAttributesEnforced) {
            return {fields, cannotSet};
        }
        for (const field of missingState.missing) {
            if (hasEditor(field) && canSet(field, false)) {
                fields.push(field);
            } else {
                cannotSet.push(field);
            }
        }
        return {fields, cannotSet};
    }, [forChannel, requiredAttributesEnforced, missingState.missing, canSet]);

    if (!forChannel) {
        return {
            fields: newChannelFields,
            cannotSet: NONE,
            enabled: channelAttributes.enabled,
            loading: channelAttributes.loading,
        };
    }
    return {
        fields: existingChannel.fields,
        cannotSet: existingChannel.cannotSet,
        enabled: channelAttributes.enabled && requiredAttributesEnforced,
        loading: channelAttributes.loading || missingState.loading,
    };
}
