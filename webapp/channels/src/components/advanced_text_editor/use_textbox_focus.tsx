// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';
import {useCallback, useEffect} from 'react';
import {useSelector} from 'react-redux';

import {getIsRhsExpanded, getIsRhsOpen} from 'selectors/rhs';

import type TextboxClass from 'components/textbox/textbox';

import {shouldFocusMainTextbox} from 'utils/post_utils';
import * as UserAgent from 'utils/user_agent';

const useTextboxFocus = (
    textboxRef: React.RefObject<TextboxClass>,
    channelId: string,
    postId: string,
    isThreadView: boolean,
    canPost: boolean,
) => {
    const rhsExpanded = useSelector(getIsRhsExpanded);
    const rhsOpen = useSelector(getIsRhsOpen);

    const focusTextbox = useCallback((keepFocus = false) => {
        const postTextboxDisabled = !canPost;
        if (textboxRef.current && postTextboxDisabled) {
            textboxRef.current.blur(); // Fixes Firefox bug which causes keyboard shortcuts to be ignored (MM-22482)
            return;
        }
        if (textboxRef.current && (keepFocus || !UserAgent.isMobile())) {
            textboxRef.current.focus();
        }
    }, [canPost, textboxRef]);

    const focusTextboxIfNecessary = useCallback((e: KeyboardEvent) => {
        // Focus should go to the RHS when it is expanded
        if (!postId && rhsExpanded) {
            return;
        }

        // Hacky fix to avoid cursor jumping textbox sometimes
        if (!postId && rhsOpen && document.activeElement?.tagName === 'BODY') {
            return;
        }

        // Should only focus in RHS if RHS is expanded or if thread view
        if (postId && !isThreadView && !rhsExpanded) {
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
    }, [focusTextbox, postId, rhsExpanded, rhsOpen, isThreadView]);

    // Register events for onkeydown
    useEffect(() => {
        document.addEventListener('keydown', focusTextboxIfNecessary);
        return () => {
            document.removeEventListener('keydown', focusTextboxIfNecessary);
        };
    }, [focusTextboxIfNecessary]);

    // Focus on textbox on channel switch
    useEffect(() => {
        focusTextbox();
    }, [channelId]);

    return focusTextbox;
};

export default useTextboxFocus;
