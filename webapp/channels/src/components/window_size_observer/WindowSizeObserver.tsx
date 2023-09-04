// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import throttle from 'lodash/throttle';

import {setLhsSize} from 'actions/views/lhs';
import {setRhsSize} from 'actions/views/rhs';

import {SidebarSize} from 'components/resizable_sidebar/constants';

import Constants from 'utils/constants';

const smallSidebarMediaQuery = window.matchMedia(`(max-width: ${Constants.SMALL_SIDEBAR_BREAKPOINT}px)`);
const mediumSidebarMediaQuery = window.matchMedia(`(min-width: ${Constants.SMALL_SIDEBAR_BREAKPOINT + 1}px) and (max-width: ${Constants.MEDIUM_SIDEBAR_BREAKPOINT}px)`);
const largeSidebarMediaQuery = window.matchMedia(`(min-width: ${Constants.MEDIUM_SIDEBAR_BREAKPOINT + 1}px) and (max-width: ${Constants.LARGE_SIDEBAR_BREAKPOINT}px)`);
const xLargeSidebarMediaQuery = window.matchMedia(`(min-width: ${Constants.LARGE_SIDEBAR_BREAKPOINT + 1}px)`);

function WindowSizeObserver() {
    const dispatch = useDispatch();

    const updateSidebarSize = useCallback(() => {
        switch (true) {
        case xLargeSidebarMediaQuery.matches:
            dispatch(setLhsSize(SidebarSize.XLARGE));
            dispatch(setRhsSize(SidebarSize.XLARGE));
            break;
        case largeSidebarMediaQuery.matches:
            dispatch(setLhsSize(SidebarSize.LARGE));
            dispatch(setRhsSize(SidebarSize.LARGE));
            break;
        case mediumSidebarMediaQuery.matches:
            dispatch(setLhsSize(SidebarSize.MEDIUM));
            dispatch(setRhsSize(SidebarSize.MEDIUM));
            break;
        case smallSidebarMediaQuery.matches:
            dispatch(setLhsSize(SidebarSize.SMALL));
            dispatch(setRhsSize(SidebarSize.SMALL));
            break;
        }
    }, [dispatch]);

    const setSidebarSizeWhenWindowResized = useCallback(throttle(() => {
        dispatch(setLhsSize());
        dispatch(setRhsSize());
    }, 100), []);

    const handleSidebarMediaQueryChangeEvent = useCallback((e: MediaQueryListEvent) => {
        if (e.matches) {
            updateSidebarSize();
        }
    }, [updateSidebarSize]);

    useEffect(() => {
        updateSidebarSize();

        if (smallSidebarMediaQuery.addEventListener) {
            xLargeSidebarMediaQuery.addEventListener('change', handleSidebarMediaQueryChangeEvent);
            largeSidebarMediaQuery.addEventListener('change', handleSidebarMediaQueryChangeEvent);
            mediumSidebarMediaQuery.addEventListener('change', handleSidebarMediaQueryChangeEvent);
            smallSidebarMediaQuery.addEventListener('change', handleSidebarMediaQueryChangeEvent);
        } else if (smallSidebarMediaQuery.addListener) {
            xLargeSidebarMediaQuery.addListener(handleSidebarMediaQueryChangeEvent);
            largeSidebarMediaQuery.addListener(handleSidebarMediaQueryChangeEvent);
            mediumSidebarMediaQuery.addListener(handleSidebarMediaQueryChangeEvent);
            smallSidebarMediaQuery.addListener(handleSidebarMediaQueryChangeEvent);
        } else {
            window.addEventListener('resize', setSidebarSizeWhenWindowResized);
        }

        return () => {
            if (smallSidebarMediaQuery.removeEventListener) {
                xLargeSidebarMediaQuery.removeEventListener('change', handleSidebarMediaQueryChangeEvent);
                largeSidebarMediaQuery.removeEventListener('change', handleSidebarMediaQueryChangeEvent);
                mediumSidebarMediaQuery.removeEventListener('change', handleSidebarMediaQueryChangeEvent);
                smallSidebarMediaQuery.removeEventListener('change', handleSidebarMediaQueryChangeEvent);
            } else if (smallSidebarMediaQuery.removeListener) {
                xLargeSidebarMediaQuery.removeListener(handleSidebarMediaQueryChangeEvent);
                largeSidebarMediaQuery.removeListener(handleSidebarMediaQueryChangeEvent);
                mediumSidebarMediaQuery.removeListener(handleSidebarMediaQueryChangeEvent);
                smallSidebarMediaQuery.removeListener(handleSidebarMediaQueryChangeEvent);
            } else {
                window.removeEventListener('resize', setSidebarSizeWhenWindowResized);
            }
        };
    }, [handleSidebarMediaQueryChangeEvent, setSidebarSizeWhenWindowResized, updateSidebarSize]);

    return null;
}

export default WindowSizeObserver;
