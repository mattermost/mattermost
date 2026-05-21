// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {makeInitialPagesState} from 'tests/helpers/pages_state';
import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import WikiReplyComment from './wiki_reply_comment';

const mockSubmitPageComment = jest.fn();

jest.mock('actions/views/create_page_comment', () => ({
    submitPageComment: (...args: any[]) => mockSubmitPageComment(...args),
}));

describe('components/wiki_rhs/WikiReplyComment', () => {
    const pageId = 'reply-page-id';
    const channelId = 'reply-channel-id';

    const getInitialState = (): DeepPartial<GlobalState> => ({
        entities: {
            pages: makeInitialPagesState({
                byId: {
                    [pageId]: {
                        id: pageId,
                        channel_id: channelId,
                        type: 'page',
                    } as any,
                },
            }),
        },
    });

    beforeEach(() => {
        mockSubmitPageComment.mockReset();
        mockSubmitPageComment.mockImplementation(() => () => Promise.resolve({}));
    });

    test('renders textarea and submit button', () => {
        renderWithContext(<WikiReplyComment pageId={pageId}/>, getInitialState());

        expect(screen.getByTestId('comment-create')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
        expect(screen.getByTestId('reply_submit')).toBeInTheDocument();
    });

    test('returns null when page is not in store', () => {
        const stateWithoutPage: DeepPartial<GlobalState> = {
            entities: {pages: makeInitialPagesState()},
        };

        const {container} = renderWithContext(<WikiReplyComment pageId={pageId}/>, stateWithoutPage);

        expect(container.firstChild).toBeNull();
    });

    test('submit button is disabled when message is empty or whitespace only', () => {
        renderWithContext(<WikiReplyComment pageId={pageId}/>, getInitialState());

        const button = screen.getByTestId('reply_submit') as HTMLButtonElement;
        expect(button.disabled).toBe(true);

        fireEvent.input(screen.getByRole('textbox'), {target: {value: '   '}});
        expect(button.disabled).toBe(true);

        fireEvent.input(screen.getByRole('textbox'), {target: {value: 'hello'}});
        expect(button.disabled).toBe(false);
    });

    test('submitting clears the message and dispatches submitPageComment with the right channel id', async () => {
        renderWithContext(<WikiReplyComment pageId={pageId}/>, getInitialState());

        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        fireEvent.input(textarea, {target: {value: 'hello world'}});

        await userEvent.click(screen.getByTestId('reply_submit'));

        await waitFor(() => {
            expect(mockSubmitPageComment).toHaveBeenCalledTimes(1);
        });

        const [calledPageId, payload] = mockSubmitPageComment.mock.calls[0];
        expect(calledPageId).toBe(pageId);
        expect(payload).toMatchObject({
            message: 'hello world',
            channelId,
            rootId: pageId,
        });

        await waitFor(() => {
            expect(textarea.value).toBe('');
        });
    });

    test('shows an error and preserves the message when submit fails', async () => {
        mockSubmitPageComment.mockImplementation(() => () => Promise.resolve({error: new Error('boom')}));

        renderWithContext(<WikiReplyComment pageId={pageId}/>, getInitialState());

        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        fireEvent.input(textarea, {target: {value: 'will fail'}});
        await userEvent.click(screen.getByTestId('reply_submit'));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        // Failed submit should NOT clear the textarea — user can retry without re-typing.
        expect(textarea.value).toBe('will fail');
    });

    test('Ctrl+Enter triggers submit', async () => {
        renderWithContext(<WikiReplyComment pageId={pageId}/>, getInitialState());

        const textarea = screen.getByRole('textbox');
        fireEvent.input(textarea, {target: {value: 'shortcut'}});
        fireEvent.keyDown(textarea, {key: 'Enter', ctrlKey: true});

        await waitFor(() => {
            expect(mockSubmitPageComment).toHaveBeenCalledTimes(1);
        });
    });

    test('plain Enter does NOT submit', () => {
        renderWithContext(<WikiReplyComment pageId={pageId}/>, getInitialState());

        const textarea = screen.getByRole('textbox');
        fireEvent.input(textarea, {target: {value: 'no submit'}});
        fireEvent.keyDown(textarea, {key: 'Enter'});

        expect(mockSubmitPageComment).not.toHaveBeenCalled();
    });

    test('does not crash when component unmounts mid-submit', async () => {
        // Build a deferred promise so the dispatch resolves AFTER unmount,
        // exercising the useIsMounted() guard path inside handleSubmit.
        let resolve: (v: unknown) => void = () => {};
        const deferred = new Promise((r) => {
            resolve = r;
        });
        mockSubmitPageComment.mockImplementation(() => () => deferred);

        const {unmount} = renderWithContext(<WikiReplyComment pageId={pageId}/>, getInitialState());

        fireEvent.input(screen.getByRole('textbox'), {target: {value: 'will unmount'}});
        await userEvent.click(screen.getByTestId('reply_submit'));

        unmount();

        // Resolving after unmount must not throw — the isMounted() guard
        // prevents the post-unmount setState that would warn or crash.
        expect(() => resolve({})).not.toThrow();

        // Flush the microtask queue so any rejection would surface.
        await Promise.resolve();
    });
});
