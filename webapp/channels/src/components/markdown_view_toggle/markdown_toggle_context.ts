// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createContext} from 'react';

// Whether a Markdown code block may offer its Preview/Code toggle. Off unless a surface turns it on, so Markdown
// rendered anywhere new (a file preview, a card, a block that is itself rendered Markdown) can't grow a nested toggle.
const MarkdownToggleContext = createContext(false);

// The post a Markdown code block belongs to. Rendering the block's source as Markdown needs it so the rendered image
// blocking (unsafe_links) follows the original post, rather than treating the source as a post-less message.
export const MarkdownPostIdContext = createContext<string | undefined>(undefined);

export default MarkdownToggleContext;
