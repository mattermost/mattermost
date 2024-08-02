// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {getCustomEmojis, searchCustomEmojis} from 'mattermost-redux/actions/emojis';
import {getCustomEmojiIdsSortedByName} from 'mattermost-redux/selectors/entities/emojis';

import EmojiList from './emoji_list';

function mapStateToProps(state: GlobalState) {
    return {
        emojiIds: getCustomEmojiIdsSortedByName(state) || [],
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getCustomEmojis,
            searchCustomEmojis,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EmojiList);
