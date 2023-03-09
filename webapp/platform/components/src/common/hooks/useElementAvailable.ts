// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef, useState, useMemo} from 'react';

export function useElementAvailable(
    elementIds: string[],
    intervalMS = 250,
): boolean {
    const checkAvailableInterval = useRef<NodeJS.Timeout | null>(null);
    const [available, setAvailable] = useState(false);
    useEffect(() => {
        if (available) {
            if (checkAvailableInterval.current) {
                clearInterval(checkAvailableInterval.current);
                checkAvailableInterval.current = null;
            }
            return;
        } else if (checkAvailableInterval.current) {
            return;
        }
        checkAvailableInterval.current = setInterval(() => {
            if (elementIds.every((x) => document.getElementById(x))) {
                setAvailable(true);
                if (checkAvailableInterval.current) {
                    clearInterval(checkAvailableInterval.current);
                    checkAvailableInterval.current = null;
                }
            }
        }, intervalMS);
    }, []);

    return useMemo(() => available, [available]);
}
