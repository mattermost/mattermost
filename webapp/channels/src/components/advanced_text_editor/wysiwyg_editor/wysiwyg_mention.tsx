// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Node} from '@tiptap/core';
import type {NodeViewProps} from '@tiptap/react';
import {NodeViewWrapper, ReactNodeViewRenderer as reactNodeViewRenderer} from '@tiptap/react';
import React from 'react';
import {useSelector} from 'react-redux';

import {getChannelNameToDisplayNameMap} from 'mattermost-redux/selectors/entities/channels';

import AtMention from 'components/at_mention';

import type {GlobalState} from 'types/store';

const MENTION_START = /(?<![\w@~])[@~][a-z0-9_]/i;
const USER_MENTION = /^@([a-z0-9.\-_]+(?::[a-z0-9.\-_]+)?)/i;
const CHANNEL_MENTION = /^~([a-z0-9\-_]+)/i;

export const parseMentionTerm = (term: string) => {
    const match = USER_MENTION.exec(term) ?? CHANNEL_MENTION.exec(term);
    if (!match || match[0] !== term) {
        return undefined;
    }
    return {char: term[0], name: match[1]};
};

const MentionView = ({node}: NodeViewProps) => {
    const {char, name} = node.attrs;
    const text = `${char}${name}`;
    const channelDisplayName = useSelector((state: GlobalState) => (char === '~' ? getChannelNameToDisplayNameMap(state)[name] : undefined));

    let content: React.ReactNode = text;
    if (char === '@') {
        content = (
            <AtMention
                mentionName={name}
                fetchMissingUsers={true}
            >
                {text}
            </AtMention>
        );
    } else if (channelDisplayName) {
        content = <span className='mention-link'>{'~' + channelDisplayName}</span>;
    }

    return <NodeViewWrapper as='span'>{content}</NodeViewWrapper>;
};

const WysiwygMention = Node.create({
    name: 'mention',
    inline: true,
    group: 'inline',
    atom: true,

    addAttributes() {
        return {
            char: {default: '@'},
            name: {default: ''},
        };
    },

    parseHTML() {
        return [{
            tag: 'span[data-mention-name]',
            getAttrs: (element) => ({
                char: element.getAttribute('data-mention-char') ?? '@',
                name: element.getAttribute('data-mention-name'),
            }),
        }];
    },

    renderHTML({node}) {
        return ['span', {
            'data-mention-char': node.attrs.char,
            'data-mention-name': node.attrs.name,
        }, `${node.attrs.char}${node.attrs.name}`];
    },

    renderText({node}) {
        return `${node.attrs.char}${node.attrs.name}`;
    },

    markdownTokenizer: {
        name: 'mention',
        level: 'inline',
        start: (src) => src.search(MENTION_START),
        tokenize: (src, tokens) => {
            const previous = tokens[tokens.length - 1]?.raw;
            if (previous && (/[\w@~]$/).test(previous)) {
                return undefined;
            }

            const match = USER_MENTION.exec(src) ?? CHANNEL_MENTION.exec(src);
            if (!match) {
                return undefined;
            }
            return {type: 'mention', raw: match[0], char: match[0][0], name: match[1]};
        },
    },

    parseMarkdown: (token, helpers) => helpers.createNode('mention', {char: token.char, name: token.name}),

    renderMarkdown: (node) => `${node.attrs?.char ?? '@'}${node.attrs?.name ?? ''}`,

    addNodeView() {
        return reactNodeViewRenderer(MentionView, {as: 'span'});
    },
});

export default WysiwygMention;
