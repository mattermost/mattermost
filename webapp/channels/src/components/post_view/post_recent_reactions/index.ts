// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Emoji} from '@mattermost/types/emojis';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {toggleReaction} from 'actions/post_actions';
import {getEmojiMap, getOneClickReactionEmojis} from 'selectors/emojis';
import {getCurrentLocale} from 'selectors/i18n';

import type {GlobalState} from 'types/store';

import PostReaction from './post_recent_reactions';

const getDefaultEmojis = createSelector(
    'getDefaultEmojis',
    (state: GlobalState) => getEmojiMap(state).get('thumbsup'),
    (state: GlobalState) => getEmojiMap(state).get('grinning'),
    (state: GlobalState) => getEmojiMap(state).get('white_check_mark'),
    (thumbsUp, grinning, whiteCheckMark) => {
        return [thumbsUp, grinning, whiteCheckMark] as Emoji[];
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
        emojis: getOneClickReactionEmojis(state),
        locale,
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PostReaction);
