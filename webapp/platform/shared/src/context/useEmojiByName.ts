// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {SharedContext} from './context';

export function useEmojiByName(name: string) {
    const context = React.useContext(SharedContext);

    return context.useEmojiByName(name);
}
