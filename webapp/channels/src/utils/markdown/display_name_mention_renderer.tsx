// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getUserByUsername} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import RemoveMarkdown from './remove_markdown';

/**
 * Renderer that:
 *  - Replaces @username in plain text nodes with @displayname
 *  - Strips all markdown formatting (extends RemoveMarkdown)
 *  - Preserves @mentions in code blocks and inline code without replacement
 *
 * This combines mention replacement and markdown stripping in a single pass,
 * ensuring proper separation of concerns. The output is plain text suitable
 * for notification display.
 */
export default class DisplayNameMentionRenderer extends RemoveMarkdown {
    private state: GlobalState;
    private teammateNameDisplay: string;

    constructor(state: GlobalState, teammateNameDisplay: string) {
        super();
        this.state = state;
        this.teammateNameDisplay = teammateNameDisplay;
    }

    public text(text: string) {
        if (!text || text.indexOf('@') === -1) {
            return super.text(text);
        }

        const replacedText = text.replace(Constants.MENTIONS_REGEX, (username: string) => {
            const raw = username.slice(1); // Remove the '@' prefix
            const lower = raw.toLowerCase();

            if (Constants.SPECIAL_MENTIONS.includes(lower)) {
                return username;
            }

            const user = getUserByUsername(this.state, lower);
            if (!user) {
                return username;
            }

            const displayname = displayUsername(user, this.teammateNameDisplay, false);
            return `@${displayname}`;
        });

        return super.text(replacedText);
    }
}
