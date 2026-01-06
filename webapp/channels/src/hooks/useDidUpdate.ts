// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Disable consistent return since the effectCallback allows for non consistent returns.
/* eslint-disable consistent-return */

import {useEffect, useRef} from 'react';

const useDidUpdate: typeof useEffect = (effect, deps) => {
    const mounted = useRef(false);
    useEffect(() => {
        if (mounted.current) {
            return effect();
        }

        mounted.current = true;
    }, deps);
};

export default useDidUpdate;
