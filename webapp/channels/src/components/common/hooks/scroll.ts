// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

export function useScrollOnRender() {
    const ref = React.useRef<HTMLElement>(null);

    React.useEffect(() => {
        if (ref.current) {
            ref.current.scrollIntoView({behavior: 'smooth'});
        }
    }, []);

    return ref;
}
