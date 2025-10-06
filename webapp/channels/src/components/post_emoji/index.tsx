// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';

import {getEmojiMap} from 'selectors/emojis';

import type {GlobalState} from 'types/store';

import PostEmoji from './post_emoji';

type Props = {
    name: string;
};

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const emojiMap = getEmojiMap(state);
    const emoji = emojiMap.get(ownProps.name);

    let emojiDescription = '';
    if (emoji) {
        // For custom emojis, use the description field
        if ('description' in emoji && emoji.description) {
            emojiDescription = emoji.description;
        } else if ('name' in emoji) {
            // For system emojis, use the name field (unicode description)
            emojiDescription = emoji.name;
        }
    }

    return {
        imageUrl: emoji ? getEmojiImageUrl(emoji) : '',
        emojiDescription,
    };
}

export default connect(mapStateToProps)(PostEmoji);
