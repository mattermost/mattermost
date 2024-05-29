// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useLayoutEffect, useRef} from 'react';

import Constants, {WindowSizes} from 'utils/constants';

import type {PropsFromRedux} from './index';

type Props = PropsFromRedux;

export default function MobileViewWatcher(props: Props) {
    const desktopMediaQuery = useRef(window.matchMedia(`(min-width: ${Constants.DESKTOP_SCREEN_WIDTH + 1}px)`));
    const smallDesktopMediaQuery = useRef(window.matchMedia(`(min-width: ${Constants.TABLET_SCREEN_WIDTH + 1}px) and (max-width: ${Constants.DESKTOP_SCREEN_WIDTH}px)`));
    const tabletMediaQuery = useRef(window.matchMedia(`(min-width: ${Constants.MOBILE_SCREEN_WIDTH + 1}px) and (max-width: ${Constants.TABLET_SCREEN_WIDTH}px)`));
    const mobileMediaQuery = useRef(window.matchMedia(`(max-width: ${Constants.MOBILE_SCREEN_WIDTH}px)`));

    const updateWindowSize = useCallback(() => {
        if (desktopMediaQuery.current.matches) {
            props.emitBrowserWindowResized(WindowSizes.DESKTOP_VIEW);
        } else if (smallDesktopMediaQuery.current.matches) {
            props.emitBrowserWindowResized(WindowSizes.SMALL_DESKTOP_VIEW);
        } else if (tabletMediaQuery.current.matches) {
            props.emitBrowserWindowResized(WindowSizes.TABLET_VIEW);
        } else if (mobileMediaQuery.current.matches) {
            props.emitBrowserWindowResized(WindowSizes.MOBILE_VIEW);
        }
    }, []);

    useLayoutEffect(() => {
        updateWindowSize();
    }, [updateWindowSize]);

    useEffect(() => {
        const handleMediaQueryChangeEvent = (e: MediaQueryListEvent) => {
            if (e.matches) {
                updateWindowSize();
            }
        };

        desktopMediaQuery.current.addEventListener('change', handleMediaQueryChangeEvent);
        smallDesktopMediaQuery.current.addEventListener('change', handleMediaQueryChangeEvent);
        tabletMediaQuery.current.addEventListener('change', handleMediaQueryChangeEvent);
        mobileMediaQuery.current.addEventListener('change', handleMediaQueryChangeEvent);

        return () => {
            desktopMediaQuery.current.removeEventListener('change', handleMediaQueryChangeEvent);
            smallDesktopMediaQuery.current.removeEventListener('change', handleMediaQueryChangeEvent);
            tabletMediaQuery.current.removeEventListener('change', handleMediaQueryChangeEvent);
            mobileMediaQuery.current.removeEventListener('change', handleMediaQueryChangeEvent);
        };
    }, [updateWindowSize]);

    return null;
}
