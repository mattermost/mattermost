// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Constants from 'utils/constants';
import {EMOJI_PATTERN} from 'utils/emoticons';

import PlainRenderer from './plain_renderer';

/** A Markdown renderer that converts a post into plain text that we can search for mentions */
export default class MentionableRenderer extends PlainRenderer {
    private hasRemoteMentions: boolean = false;

    public text(text: string) {
        // Check if text contains any mentions with colons (likely remote mentions)
        const mentions = text.match(Constants.MENTIONS_REGEX) || [];
        this.hasRemoteMentions = mentions.some((mention) => mention.includes(':'));

        // Remove all emojis
        return text.replace(EMOJI_PATTERN, '');
    }

    public strong(text: string) {
        // If we detected remote mentions, preserve them by not adding spaces
        if (this.hasRemoteMentions) {
            return text;
        }

        // Otherwise, use PlainRenderer behavior (adds spaces)
        return super.strong(text);
    }

    public em(text: string) {
        // Same logic as strong
        if (this.hasRemoteMentions) {
            return text;
        }

        // Otherwise, use PlainRenderer behavior (adds spaces)
        return super.em(text);
    }
}
