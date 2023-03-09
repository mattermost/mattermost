// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {getUser, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {deleteCustomEmoji} from 'mattermost-redux/actions/emojis';

import {GenericAction} from 'mattermost-redux/types/actions';

import {getDisplayNameByUser} from 'utils/utils';

import {GlobalState} from '../../../types/store';

import EmojiListItem, {Props} from './emoji_list_item';

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const emoji = state.entities.emojis.customEmoji[ownProps.emojiId!];
    const creator = getUser(state, emoji.creator_id);

    return {
        emoji,
        creatorDisplayName: getDisplayNameByUser(state, creator),
        creatorUsername: creator ? creator.username : '',
        currentUserId: getCurrentUserId(state),
        currentTeam: getCurrentTeam(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            deleteCustomEmoji,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EmojiListItem);
