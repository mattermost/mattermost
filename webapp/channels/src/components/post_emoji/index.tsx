// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';

import {getEmojiMap} from 'selectors/emojis';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import PostEmoji from './post_emoji';

type Props = {
    name: string;
};

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const emojiMap = getEmojiMap(state);
    const emoji = emojiMap.get(ownProps.name);

    return {
        imageUrl: emoji ? getEmojiImageUrl(emoji) : '',
        autoplayGifsAndEmojis: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.AUTOPLAY_GIFS_AND_EMOJIS, Preferences.AUTOPLAY_GIFS_AND_EMOJIS_DEFAULT),
    };
}

export default connect(mapStateToProps)(PostEmoji);
