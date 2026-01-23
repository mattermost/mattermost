// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';
import {useCallback, useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {focusedRHS} from 'actions/views/rhs';
import {getIsRhsExpanded, getIsRhsOpen} from 'selectors/rhs';
import {getShouldFocusRHS} from 'selectors/views/rhs';

import useDidUpdate from 'components/common/hooks/useDidUpdate';
import type TextboxClass from 'components/textbox/textbox';

import {shouldFocusMainTextbox} from 'utils/post_utils';
import * as UserAgent from 'utils/user_agent';

const useTextboxFocus = (
    textboxRef: React.RefObject<TextboxClass>,
    channelId: string,
    isRHS: boolean,
    canPost: boolean,
) => {
    const dispatch = useDispatch();

    const hasMounted = useRef(false);

    const rhsExpanded = useSelector(getIsRhsExpanded);
    const rhsOpen = useSelector(getIsRhsOpen);
    const shouldFocusRHS = useSelector(getShouldFocusRHS, () => true);

    const focusTextbox = useCallback((keepFocus = false) => {
        const postTextboxDisabled = !canPost;
        if (textboxRef.current && postTextboxDisabled) {
            // Fixes Firefox bug which causes keyboard shortcuts to be ignored (MM-22482)
            requestAnimationFrame(() => {
                textboxRef.current?.blur();
            });
            return;
        }
        if (textboxRef.current && (keepFocus || !UserAgent.isMobile())) {
            // Focus immediately, so we capture any typed text.
            textboxRef.current?.focus();

            // Also re-focus after the next animation frame, to work around issues where the RHS is "opening".
            requestAnimationFrame(() => {
                textboxRef.current?.focus();
            });
        }
    }, [canPost]);

    const focusTextboxIfNecessary = useCallback((e: KeyboardEvent) => {
        // Do not focus if the rhs is expanded and this is not the RHS
        if (!isRHS && rhsExpanded) {
            return;
        }

        // Do not focus if the rhs is not expanded and this is the RHS
        if (isRHS && !rhsExpanded) {
            return;
        }

        // Do not focus the main textbox when the RHS is open as a hacky fix to avoid cursor jumping textbox sometimes
        if (isRHS && rhsOpen && document.activeElement?.tagName === 'BODY') {
            return;
        }

        // Bit of a hack to not steal focus from the channel switch modal if it's open
        // This is a special case as the channel switch modal does not enforce focus like
        // most modals do
        if (document.getElementsByClassName('channel-switch-modal').length) {
            return;
        }

        if (shouldFocusMainTextbox(e, document.activeElement)) {
            focusTextbox();
        }
    }, [focusTextbox, rhsExpanded, rhsOpen, isRHS]);

    // Register events for onkeydown
    useEffect(() => {
        document.addEventListener('keydown', focusTextboxIfNecessary);
        return () => {
            document.removeEventListener('keydown', focusTextboxIfNecessary);
        };
    }, [focusTextboxIfNecessary]);

    // Focus on textbox on channel switch
    useDidUpdate(() => {
        focusTextbox();
    }, [channelId]);

    useEffect(() => {
        if (isRHS && shouldFocusRHS) {
            // If we are in the RHS and we are supposed to focus the RHS because of a reply,
            // we focus the textbox and reset the shouldFocusRHS flag.
            focusTextbox();
            dispatch(focusedRHS());
        } else if (!isRHS && !shouldFocusRHS && !hasMounted.current) {
            // If we are in the Center channel and we are not supposed to focus the RHS,
            // we focus the textbox but only on mount.
            // This is because if we focus on updates, we might steal focus from the RHS
            // when the RHS focuses and resets the shouldFocusRHS flag.
            focusTextbox();
        }

        if (!hasMounted.current) {
            hasMounted.current = true;
        }
    }, [isRHS, shouldFocusRHS, focusTextbox, dispatch]);

    return focusTextbox;
};

export default useTextboxFocus;
