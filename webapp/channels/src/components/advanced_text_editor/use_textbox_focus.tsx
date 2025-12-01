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

import a11yController from 'utils/a11y_controller_instance';
import {shouldFocusMainTextbox} from 'utils/post_utils';
import * as UserAgent from 'utils/user_agent';

const CHECK_INTERVAL_MS = 100; // in milliseconds
const REQUIRED_STABLE_CHECKS = 3;
const MAX_FOCUS_RETRIES = 3;

const useTextboxFocus = (
    textboxRef: React.RefObject<TextboxClass>,
    channelId: string,
    isRHS: boolean,
    canPost: boolean,
) => {
    const dispatch = useDispatch();

    const hasMounted = useRef(false);
    const retryFocusTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const retryFocusAttemptsRef = useRef(0);
    const focusSuccessfullyRetainedRef = useRef(0);

    const rhsExpanded = useSelector(getIsRhsExpanded);
    const rhsOpen = useSelector(getIsRhsOpen);
    const shouldFocusRHS = useSelector(getShouldFocusRHS);

    function tryToFocusOnTextbox(textboxInput: HTMLInputElement) {
        // Clear any existing retry timeout
        if (retryFocusTimeoutRef.current) {
            clearTimeout(retryFocusTimeoutRef.current);
            retryFocusTimeoutRef.current = undefined;
        }

        // For RHS, use the stable focus retry mechanism
        // Reset counters for this focus attempt
        retryFocusAttemptsRef.current = 0;
        focusSuccessfullyRetainedRef.current = 0;

        const keepTryingToFocusOnTextbox = () => {
            retryFocusAttemptsRef.current++;

            // This prevents visual flashing
            if (textboxInput !== document.activeElement) {
                textboxInput.focus();
                a11yController.cancelNavigation();
            }

            // Check if focus is now on our target element
            if (textboxInput === document.activeElement) {
                // Focus is currently on our element, increment success counter
                focusSuccessfullyRetainedRef.current++;

                // We require multiple consecutive successful checks to ensure focus is "stable".
                // This prevents declaring success if another component (e.g., center channel,
                // a11y controller) briefly allows focus but then steals it back.
                if (focusSuccessfullyRetainedRef.current >= REQUIRED_STABLE_CHECKS) {
                    // We've held focus for enough consecutive checks. Stop retrying.
                    retryFocusTimeoutRef.current = undefined;
                    retryFocusAttemptsRef.current = 0;
                    focusSuccessfullyRetainedRef.current = 0;
                    return;
                }
            } else {
                // Focus is not on our element. Another element has it or focus was stolen.
                // Reset the success counter so we need to prove stability from scratch again.
                focusSuccessfullyRetainedRef.current = 0;
            }

            // Continue attempting if we haven't hit the max attempts and element is still visible
            if (retryFocusAttemptsRef.current < MAX_FOCUS_RETRIES && textboxInput.offsetParent !== null) {
                retryFocusTimeoutRef.current = setTimeout(keepTryingToFocusOnTextbox, CHECK_INTERVAL_MS);
            } else {
                // Stop trying: either max attempts reached or element is no longer visible
                retryFocusTimeoutRef.current = undefined;
                retryFocusAttemptsRef.current = 0;
                focusSuccessfullyRetainedRef.current = 0;
            }
        };

        requestAnimationFrame(() => {
            keepTryingToFocusOnTextbox();
        });
    }

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
            const textboxInput = textboxRef.current?.getInputBox();
            if (!textboxInput) {
                return;
            }

            if (isRHS) {
                tryToFocusOnTextbox(textboxInput);
            } else {
                textboxInput.focus();
            }
        }
    }, [canPost, isRHS]);

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
            // If we are in the RHS and we are supposed to focus the RHS (because of a reply),
            // we focus the textbox and reset the flag.
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

    // Cleanup retry timeout on unmount
    useEffect(() => {
        return () => {
            if (retryFocusTimeoutRef.current) {
                clearTimeout(retryFocusTimeoutRef.current);
            }
        };
    }, []);

    return focusTextbox;
};

export default useTextboxFocus;
