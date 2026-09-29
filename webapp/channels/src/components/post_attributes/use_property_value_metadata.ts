// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import type {FieldMetadata} from 'components/properties_card_view/properties_card_view';
import {textSubtype} from 'components/properties_card_view/propertyValueRenderer/renderable';

/**
 * The metadata a `text` field's subtype renderer needs, read from the store.
 *
 * Those renderers resolve nothing themselves — `properties_card_view` hands
 * them an already-fetched entity, and without one `ChannelPropertyRenderer`
 * and `TeamPropertyRenderer` report the id as *deleted* while
 * `PostPreviewPropertyRenderer` draws nothing. So a post attribute surface
 * that rendered them bare would call a live channel deleted.
 *
 * Shared by the chip row and the hover card so the two cannot resolve the same
 * value differently. Every other field type needs no metadata and gets
 * `undefined`.
 *
 * Nothing is fetched here. An entity the store has not seen stays undefined and
 * the renderer falls back, rather than this firing a request per chip per post
 * across the whole message list.
 */
export function usePropertyValueMetadata(
    field: PropertyField,
    value: PropertyValue<unknown>,
): FieldMetadata | undefined {
    const subType = field.type === 'text' ? textSubtype(field) : '';
    const id = typeof value.value === 'string' ? value.value : '';

    const post = useSelector((state: GlobalState) => (subType === 'post' && id ? getPost(state, id) : undefined));

    // A post preview names the channel and team it came from, so those are
    // resolved through the post rather than from the stored id.
    const channelId = subType === 'channel' ? id : (post?.channel_id ?? '');
    const channel = useSelector((state: GlobalState) => (channelId ? getChannel(state, channelId) : undefined));

    const teamId = subType === 'team' ? id : (channel?.team_id ?? '');
    const team = useSelector((state: GlobalState) => (teamId ? getTeam(state, teamId) : undefined));

    return useMemo(() => {
        switch (subType) {
        case 'post':
            return {post, channel, team};
        case 'channel':
            return {channel};
        case 'team':
            return {team};
        default:
            return undefined;
        }
    }, [subType, post, channel, team]);
}
