// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';

// hack to disallow closing payment modal with escape.
// Wrapping the function in this way enables the
// somewhat common use case accidental modal open followed
// by immediate closing by pressing escape
function makeDisallowEscape() {
    let hitOtherKey = false;
    return function disallowEscape(e: KeyboardEvent) {
        if (e.key === 'Escape' && hitOtherKey) {
            e.preventDefault();
            e.stopPropagation();
        }
        hitOtherKey = true;
    };
}

export default function useNoEscape() {
    useEffect(() => {
        const disallowEscape = makeDisallowEscape();
        document.addEventListener('keydown', disallowEscape, true);
        return () => {
            document.removeEventListener('keydown', disallowEscape, true);
        };
    }, []);
}
