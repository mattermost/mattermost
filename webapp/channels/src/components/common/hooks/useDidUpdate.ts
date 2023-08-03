// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import { useEffect, useRef } from "react"

const useDidUpdate: typeof useEffect = (effect, deps) => {
    const mounted = useRef(false);
    useEffect(() => {
        if (mounted.current === false) {
            mounted.current = true;
        } else {
            return effect();
        }
    }, deps)
}

export default useDidUpdate;