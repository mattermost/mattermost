// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';

import {getEmojiMap} from 'selectors/emojis';

import PostEmoji from './post_emoji';

import type {GlobalState} from 'types/store';

type Props = {
    name: string;
};

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const emojiMap = getEmojiMap(state);
    const emoji = emojiMap.get(ownProps.name);

    return {
        imageUrl: emoji ? getEmojiImageUrl(emoji) : '',
    };
}

export default connect(mapStateToProps)(PostEmoji);
