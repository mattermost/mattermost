// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {usePostAttributeFields} from 'components/common/hooks/usePostAttributes';

import type {GlobalState} from 'types/store';

import {canEditPostAttributeValue, isChannelPropertyAdmin} from './permissions';
import type {ComposerPropertyValue} from './use_staged_post_attributes';
import {useAddableAttributes} from './utils';

export type ComposerAttributes = {

    // Every field the channel declares.
    fields: PropertyField[];

    // Whether the current user may write a field when composing a post here.
    canEdit: (field: PropertyField) => boolean;

    // The fields the add controls may offer right now: not already shown, and
    // ones this user could fill in.
    addable: PropertyField[];
};

// The edit modal's hooks take store-shaped values, so each staged pair is
// padded out with placeholders. Nothing downstream reads the placeholder fields.
export function toPropertyValue(value: ComposerPropertyValue): PropertyValue<unknown> {
    return {
        id: '',
        target_id: '',
        target_type: '',
        group_id: '',
        field_id: value.field_id,
        value: value.value,
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

/**
 * The channel's post attribute fields as the composer sees them.
 *
 * Called once, by the editor, which hands the result to the chips and to both
 * add controls (the `+` in the action row and the inline control after the
 * chips), so they all work from the same fields and the same permission answer.
 *
 * There is no post yet, so `canEditPostAttributeValue` gets a stub authored by
 * the current user, as `CanSetPostPropertyValueOnCreate` assumes server-side.
 */
export function useComposerAttributes(
    channelId: string,
    values: ComposerPropertyValue[],
    added: ReadonlySet<string>,
): ComposerAttributes {
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const currentUserId = useSelector(getCurrentUserId);
    const isSystemAdmin = useSelector(isCurrentUserSystemAdmin);
    const isChannelAdmin = useSelector((state: GlobalState) => (channel ? isChannelPropertyAdmin(state, channel) : false));

    const fields = usePostAttributeFields(channel);

    const authorStub = useMemo(() => ({user_id: currentUserId, channel_id: channelId} as Post), [currentUserId, channelId]);

    const canEdit = useCallback(
        (field: PropertyField) => canEditPostAttributeValue(field, authorStub, currentUserId, isSystemAdmin, isChannelAdmin),
        [authorStub, currentUserId, isSystemAdmin, isChannelAdmin],
    );

    const propertyValues = useMemo(() => values.map(toPropertyValue), [values]);
    const addable = useAddableAttributes(fields, propertyValues, added, canEdit);

    return useMemo(() => ({fields, canEdit, addable}), [fields, canEdit, addable]);
}
