// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

export default function EmojiPickerTabList() {
    return (
        <div
            role='tablist'
            style={{display: 'flex', width: 'fit-content'}}
        >
            <li
                role='presentation'
                style={{fontSize: 12, fontWeight: 600}}
            />
            <li
                role='presentation'
                style={{fontSize: 12, fontWeight: 600}}
            />
        </div>
    );
}
