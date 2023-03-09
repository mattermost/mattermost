// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {useSelector} from 'react-redux';
import throttle from 'lodash/throttle';

import {get, getInt} from 'mattermost-redux/selectors/entities/preferences';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import {GlobalState} from '@mattermost/types/store';

import {TutorialTourTipPunchout} from './backdrop';

type PunchoutOffset = {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function useMeasurePunchouts(
    elements: Array<null | string | HTMLElement>,
    additionalDeps: any[], offset?: PunchoutOffset
): TutorialTourTipPunchout | null {
    const elementsAvailable = useElementAvailable(elements);
    const [size, setSize] = useState<DOMRect>();
    const updateSize = throttle(() => {
        setSize(document.getElementById('root')?.getBoundingClientRect());
    }, 100);

    useLayoutEffect(() => {
        window.addEventListener('resize', updateSize);
        return () =>
            window.removeEventListener('resize', updateSize);
    }, []);

    return useMemo(() => {
        let minX = Number.MAX_SAFE_INTEGER;
        let minY = Number.MAX_SAFE_INTEGER;
        let maxX = Number.MIN_SAFE_INTEGER;
        let maxY = Number.MIN_SAFE_INTEGER;
        for (let i = 0; i < elements.length; i++) {
            const elOrId = elements[i];
            const el = ((typeof elOrId !== 'string' && elOrId) || (elOrId && document.getElementById(elOrId)));
            if (!el) {
                return null;
            }
            const {x, y, width, height} = el.getBoundingClientRect();
            if (x < minX) {
                minX = x;
            }
            if (y < minY) {
                minY = y;
            }
            if (x + width > maxX) {
                maxX = x + width;
            }
            if (y + height > maxY) {
                maxY = y + height;
            }
        }

        return {
            x: `${minX + (offset ? offset.x : 0)}px`,
            y: `${minY + (offset ? offset.y : 0)}px`,
            width: `${(maxX - minX) + (offset ? offset.width : 0)}px`,
            height: `${(maxY - minY) + (offset ? offset.height : 0)}px`,
        };
    }, [...elements, ...additionalDeps, size, elementsAvailable]);
}

export const useShowTutorialStep = (stepToShow: number, category: string, defaultAutostart = true): boolean => {
    const currentUserId = useSelector(getCurrentUserId);
    const step = useSelector<GlobalState, number | null>((state: GlobalState) => {
        if (defaultAutostart) {
            return getInt(state, category, currentUserId, 0);
        }
        const value = get(state, category, currentUserId, null);
        return value === null ? null : parseInt(value, 10);
    });

    return step === stepToShow;
};

export const useElementAvailable = (elements: Array<null | string | HTMLElement>): boolean => {
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
            if (elements.every((x) => (typeof x !== 'string' && x) || (x && document.getElementById(x)))) {
                setAvailable(true);
                if (checkAvailableInterval.current) {
                    clearInterval(checkAvailableInterval.current);
                    checkAvailableInterval.current = null;
                }
            }
        }, 500);
    }, []);

    return useMemo(() => available, [available]);
};

