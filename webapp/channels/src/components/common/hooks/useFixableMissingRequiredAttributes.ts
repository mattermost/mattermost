// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {PropertyField} from '@mattermost/types/properties';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {hasEditor} from 'components/channel_attributes/channel_attribute_editor_support';

import {useChannelKind} from 'hooks/useChannelKind';
import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import useCanSetChannelAttributes from './useCanSetChannelAttributes';
import useIsChannelAttributeAdmin from './useIsChannelAttributeAdmin';
import useMissingRequiredChannelAttributes from './useMissingRequiredChannelAttributes';

export type FixableMissingRequiredAttributes = {
    fields: PropertyField[];
    firstFieldId?: string;
};

const NONE: FixableMissingRequiredAttributes = {fields: []};

/**
 * The required attributes this channel lacks a value for that the current user can
 * set from Channel Info, in the order Channel Info lists them. The notice, the Info
 * button dot, the header chip and the Channel Info rows all read this, so they
 * cannot disagree about whether a channel needs attention.
 *
 * Values come from the store when the channel's are already loaded, so switching to
 * a loaded channel makes no request.
 */
export default function useFixableMissingRequiredAttributes(
    channelId: string,
    {skip = false}: {skip?: boolean} = {},
): FixableMissingRequiredAttributes {
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const isBoard = useChannelKind({id: channelId}) === 'board';
    const eligible = !skip &&
        Boolean(channel) &&
        (channel?.type === Constants.OPEN_CHANNEL || channel?.type === Constants.PRIVATE_CHANNEL) &&
        !channel?.delete_at &&
        !isBoard;

    const {missing} = useMissingRequiredChannelAttributes(channelId, {preferStore: true, skip: !eligible});
    const isChannelAdmin = useIsChannelAttributeAdmin(channelId);
    const canSet = useCanSetChannelAttributes(channelId);

    return useMemo(() => {
        if (!eligible || !isChannelAdmin || missing.length === 0) {
            return NONE;
        }
        const fields = missing.filter((field) => hasEditor(field) && canSet(field, false));
        if (fields.length === 0) {
            return NONE;
        }
        return {fields, firstFieldId: fields[0].id};
    }, [eligible, isChannelAdmin, missing, canSet]);
}
