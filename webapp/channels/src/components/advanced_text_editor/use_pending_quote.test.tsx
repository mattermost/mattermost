// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type TextboxClass from 'components/textbox/textbox';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import usePendingQuote from './use_pending_quote';
import type {WysiwygEditorHandle} from './wysiwyg_editor/wysiwyg_editor';

describe('usePendingQuote', () => {
    const channelId = 'channel_id';
    const draft = TestHelper.getPostDraftMock({channelId, rootId: '', message: 'Hey there'});

    const initialState = {
        views: {
            drafts: {
                pendingQuote: {channelId, rootId: '', text: 'quoted text'},
            },
        },
    };

    function renderPendingQuote(isDisabled: boolean, isBusy: boolean) {
        const handleDraftChange = jest.fn();
        const textboxRef = React.createRef<TextboxClass>();
        const wysiwygRef = React.createRef<WysiwygEditorHandle>();
        const state = {isDisabled, isBusy};

        const {rerender} = renderHookWithContext(
            () => usePendingQuote(draft, handleDraftChange, channelId, '', false, state.isDisabled, state.isBusy, textboxRef, wysiwygRef),
            initialState,
        );

        const update = (changes: Partial<typeof state>) => {
            Object.assign(state, changes);
            rerender();
        };

        return {handleDraftChange, update};
    }

    test('should append the quote to the draft', () => {
        const {handleDraftChange} = renderPendingQuote(false, false);

        expect(handleDraftChange).toHaveBeenCalledWith({...draft, message: 'Hey there\n\n> quoted text\n\n'}, {instant: true});
    });

    test('should keep the quote while the message box is busy and add it once it is done', () => {
        const {handleDraftChange, update} = renderPendingQuote(true, true);

        expect(handleDraftChange).not.toHaveBeenCalled();

        update({isDisabled: false, isBusy: false});

        expect(handleDraftChange).toHaveBeenCalledTimes(1);
        expect(handleDraftChange).toHaveBeenCalledWith({...draft, message: 'Hey there\n\n> quoted text\n\n'}, {instant: true});
    });

    test('should drop the quote when the message box cannot be used', () => {
        const {handleDraftChange, update} = renderPendingQuote(true, false);

        expect(handleDraftChange).not.toHaveBeenCalled();

        update({isDisabled: false, isBusy: false});

        expect(handleDraftChange).not.toHaveBeenCalled();
    });
});
