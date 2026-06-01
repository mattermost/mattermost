// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import Permissions from 'mattermost-redux/constants/permissions';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

export function useWikiCommentTextbox() {
    const channelId = useSelector(getCurrentChannelId) ?? '';
    const teamId = useSelector(getCurrentTeamId);
    const maxPostSize = useSelector((state: GlobalState) => parseInt(getConfig(state).MaxPostSize || '', 10) || Constants.DEFAULT_CHARACTER_LIMIT);
    const useChannelMentions = useSelector((state: GlobalState) =>
        (channelId ? haveIChannelPermission(state, teamId, channelId, Permissions.USE_CHANNEL_MENTIONS) : false),
    );
    return {channelId, maxPostSize, useChannelMentions};
}
