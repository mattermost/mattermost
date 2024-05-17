// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Emoji} from '@mattermost/types/emojis';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {toggleReaction} from 'actions/post_actions';
import {getEmojiMap} from 'selectors/emojis';
import {getCurrentLocale} from 'selectors/i18n';

import type EmojiMap from 'utils/emoji_map';

import type {GlobalState} from 'types/store';

import PostReaction from './post_recent_reactions';

const getDefaultEmojis = createSelector(
    'getDefaultEmojis',
    getEmojiMap, // HARRISON this is fine other than me memoizing it
    (emojiMap: EmojiMap) => {
        return [emojiMap.get('thumbsup'), emojiMap.get('grinning'), emojiMap.get('white_check_mark')] as Emoji[];
    },
);

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            toggleReaction,
        }, dispatch),
    };
}

function mapStateToProps(state: GlobalState) {
    const locale = getCurrentLocale(state);

    return {
        defaultEmojis: getDefaultEmojis(state),
        locale,
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PostReaction);
