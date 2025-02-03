// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useRef} from 'react';

import type TextboxClass from 'components/textbox/textbox';

import * as UserAgent from 'utils/user_agent';

const useOrientationHandler = (
    textboxRef: React.RefObject<TextboxClass>,
    postId: string,
) => {
    const lastOrientation = useRef('');

    const onOrientationChange = useCallback(() => {
        if (!UserAgent.isIosWeb()) {
            return;
        }

        const LANDSCAPE_ANGLE = 90;
        let orientation = 'portrait';
        if (window.orientation) {
            orientation = Math.abs(window.orientation as number) === LANDSCAPE_ANGLE ? 'landscape' : 'portrait';
        }

        if (window.screen.orientation) {
            orientation = window.screen.orientation.type.split('-')[0];
        }

        if (
            lastOrientation.current &&
            orientation !== lastOrientation.current &&
            (document.activeElement || {}).id === 'post_textbox'
        ) {
            textboxRef.current?.blur();
        }

        lastOrientation.current = orientation;
    }, [textboxRef]);

    useEffect(() => {
        if (!postId && UserAgent.isIosWeb()) {
            onOrientationChange();
            if (window.screen.orientation && 'onchange' in window.screen.orientation) {
                window.screen.orientation.addEventListener('change', onOrientationChange);
            } else if ('onorientationchange' in window) {
                window.addEventListener('orientationchange', onOrientationChange);
            }
        }
        return () => {
            if (!postId) {
                if (window.screen.orientation && 'onchange' in window.screen.orientation) {
                    window.screen.orientation.removeEventListener('change', onOrientationChange);
                } else if ('onorientationchange' in window) {
                    window.removeEventListener('orientationchange', onOrientationChange);
                }
            }
        };
    }, []);
};

export default useOrientationHandler;
