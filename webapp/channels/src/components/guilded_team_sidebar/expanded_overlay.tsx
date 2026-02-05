// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

interface Props {
    onClose: () => void;
}

export default function ExpandedOverlay({onClose}: Props) {
    return (
        <div className='expanded-overlay'>
            <button onClick={onClose} aria-label='Close'>×</button>
            <div>Expanded Overlay - Coming Soon</div>
        </div>
    );
}
