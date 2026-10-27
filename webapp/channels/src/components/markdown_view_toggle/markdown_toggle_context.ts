// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createContext} from 'react';

// Whether a Markdown code block may offer its Preview/Code toggle. Off unless a surface turns it on, so Markdown
// rendered anywhere new (a file preview, a card, a block that is itself rendered Markdown) can't grow a nested toggle.
const MarkdownToggleContext = createContext(false);

export default MarkdownToggleContext;
