// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import FlagPostModal from './flag_post_modal';

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

    it('should render modal with reasons and post preview', () => {
        renderWithContext(
            <FlagPostModal
                postId={'post_id'}
                onExited={() => {}}
            />,
            baseState,
        );

        userEvent.click(screen.getByText('Select a reason for flagging'));

        expect(screen.getByText('Reason 1')).toBeVisible();
        expect(screen.getByText('Reason 2')).toBeVisible();
        expect(screen.getByText('Reason 3')).toBeVisible();

        expect(screen.getByTestId('FlagPostModal__post-preview_container')).toHaveTextContent('Test message');
        expect(screen.getByTestId('FlagPostModal__comment_section_title')).toHaveTextContent('Comment (required)');
    });

    it('should render "required" title when comment is required', () => {
        renderWithContext(
            <FlagPostModal
                postId={'post_id'}
                onExited={() => {}}
            />,
            baseState,
        );

        expect(screen.getByTestId('FlagPostModal__comment_section_title')).toHaveTextContent('Comment (required)');
    });

    it('should render "optional" title when comment is not required', () => {
        const state = JSON.parse(JSON.stringify(baseState));
        state.entities!.contentFlagging!.settings!.reporter_comment_required = false;
        renderWithContext(
            <FlagPostModal
                postId={'post_id'}
                onExited={() => {}}
            />,
            state,
        );

        expect(screen.getByTestId('FlagPostModal__comment_section_title')).toHaveTextContent('Comment (optional)');
    });
});
