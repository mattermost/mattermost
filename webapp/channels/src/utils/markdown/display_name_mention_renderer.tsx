// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getUserByUsername} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import PlainRenderer from './plain_renderer';

/**
 * Renderer that:
 *  - Replaces @username in plain text nodes with @displayname
 *  - Leaves code blocks and inline code intact (including the @content)
 *  - Does NOT attempt replacements inside code/codespan
 * Output is used before stripMarkdown() for notification text.
 */
export default class DisplayNameMentionRenderer extends PlainRenderer {
    private state: GlobalState;
    private teammateNameDisplay: string;

    constructor(state: GlobalState, teammateNameDisplay: string) {
        super();
        this.state = state;
        this.teammateNameDisplay = teammateNameDisplay;
    }

    public code(code?: string, language?: string | null): string {
        if (!code) {
            return '\n';
        }
        const info = (language || '').trim();
        return `\n\`\`\`${info}\n${code}\n\`\`\`\n`;
    }

    public codespan(code?: string): string {
        if (!code) {
            return ' ';
        }
        return `\`${code}\``;
    }

    public text(text: string) {
        if (!text || text.indexOf('@') === -1) {
            return text;
        }

        return text.replace(Constants.MENTIONS_REGEX, (username: string) => {
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
    }
}
