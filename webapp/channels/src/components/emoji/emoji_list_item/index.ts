// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect, useSelector} from 'react-redux';
import type {Dispatch} from 'redux';
import {bindActionCreators} from 'redux';

import type {CustomEmoji} from '@mattermost/types/emojis';

import {deleteCustomEmoji} from 'mattermost-redux/actions/emojis';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getUser, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {useEmojiByName} from 'data-layer/hooks/emojis';
import {getDisplayNameByUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import EmojiListItem from './emoji_list_item';

function mapStateToProps(state: GlobalState) {
    return {
        currentTeam: getCurrentTeam(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            deleteCustomEmoji,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)((props: any) => {
    const emoji = useEmojiByName(props.emojiName);
    const creator = useSelector((state: GlobalState) => {
        if (!emoji || 'creator_id' in emoji) {
            return undefined;
        }

        return getUser(state, (emoji as unknown as CustomEmoji).creator_id);
    });

    return React.createElement(EmojiListItem, {
        ...props,
        creatorDisplayName: useSelector((state: GlobalState) => getDisplayNameByUser(state, creator)),
        creatorUsername: creator ? creator.username : '',
        currentUserId: useSelector(getCurrentUserId),
    });
});
