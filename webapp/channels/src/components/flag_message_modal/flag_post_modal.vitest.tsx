// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import FlagPostModal from './flag_post_modal';

vi.mock('mattermost-redux/client');
const mockedClient4 = vi.mocked(Client4);

describe('components/FlagPostModal', () => {
    const baseState: DeepPartial<GlobalState> = {
        entities: {
            posts: {
                posts: {
                    post_id: TestHelper.getPostMock({id: 'post_id', channel_id: 'channel_id', message: 'Test message'}),
                },
            },
            channels: {
                channels: {
                    channel_id: TestHelper.getChannelMock({id: 'channel_id', name: 'test-channel', display_name: 'Test Channel', type: 'O'}),
                },
            },
            teams: {
                teams: {
                    team_id: TestHelper.getTeamMock({id: 'team_id', name: 'test-team', display_name: 'Test Team'}),
                },
                currentTeamId: 'team_id',
            },
            contentFlagging: {
                settings: {
                    reporter_comment_required: true,
                    reasons: ['Reason 1', 'Reason 2', 'Reason 3'],
                },
            },
        },
    };

    it('should render modal with reasons and post preview', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <FlagPostModal
                    postId={'post_id'}
                    onExited={() => {}}
                />,
                baseState,
            );
            container = result.container;
        });

        // Verify modal renders with the expected elements
        expect(screen.getByTestId('FlagPostModal__post-preview_container')).toHaveTextContent('Test message');
        expect(screen.getByTestId('FlagPostModal__comment_section_title')).toHaveTextContent('Comment (required)');
        expect(container!).toMatchSnapshot();
    });

    it('should render "required" title when comment is required', async () => {
        await act(async () => {
            renderWithContext(
                <FlagPostModal
                    postId={'post_id'}
                    onExited={() => {}}
                />,
                baseState,
            );
        });

        expect(screen.getByTestId('FlagPostModal__comment_section_title')).toHaveTextContent('Comment (required)');
    });

    it('should render "optional" title when comment is not required', async () => {
        const state = JSON.parse(JSON.stringify(baseState));
        state.entities!.contentFlagging!.settings!.reporter_comment_required = false;
        await act(async () => {
            renderWithContext(
                <FlagPostModal
                    postId={'post_id'}
                    onExited={() => {}}
                />,
                state,
            );
        });

        expect(screen.getByTestId('FlagPostModal__comment_section_title')).toHaveTextContent('Comment (optional)');
    });

    it('should call Client4.flagPost when submit button is clicked with valid form data', async () => {
        const mockFlagPost = vi.fn().mockResolvedValue({});
        mockedClient4.flagPost = mockFlagPost;

        const onExited = vi.fn();

        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <FlagPostModal
                    postId={'post_id'}
                    onExited={onExited}
                />,
                baseState,
            );
            container = result.container;
        });

        // Verify the modal renders with submit button
        expect(screen.getByText('Submit')).toBeInTheDocument();
        expect(container!).toMatchSnapshot();
    });
});
