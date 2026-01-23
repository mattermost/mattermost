// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import KeepRemoveFlaggedMessageConfirmationModal from './remove_flagged_message_confirmation_modal';

jest.mock('components/common/hooks/useUser');
jest.mock('components/common/hooks/useChannel');
jest.mock('components/common/hooks/useContentFlaggingFields');

const mockedUseUser = require('components/common/hooks/useUser').useUser as jest.MockedFunction<any>;
const mockedUseChannel = require('components/common/hooks/useChannel').useChannel as jest.MockedFunction<any>;
const mockedUseContentFlaggingConfig = require('components/common/hooks/useContentFlaggingFields').useContentFlaggingConfig as jest.MockedFunction<any>;

describe('KeepRemoveFlaggedMessageConfirmationModal', () => {
    const flaggedPostAuthor = TestHelper.getUserMock({
        id: 'flagged_post_author_id',
        username: 'flagged_post_author',
    });

    const reportingUser = TestHelper.getUserMock({
        id: 'reporting_user_id',
        username: 'reporting_user',
    });

    const flaggedPostChannel = TestHelper.getChannelMock({
        id: 'flagged_post_channel_id',
        display_name: 'Flagged Post Channel',
        team_id: 'team_id',
    });

    const flaggedPost = TestHelper.getPostMock({
        id: 'flagged_post_id',
        message: 'Flagged message content',
        channel_id: flaggedPostChannel.id,
        user_id: flaggedPostAuthor.id,
    });

    const defaultContentFlaggingConfig = {
        reviewer_comment_required: false,
        notify_reporter_on_removal: false,
        notify_reporter_on_dismissal: false,
    };

    const onExited = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        mockedUseUser.mockReturnValue(flaggedPostAuthor);
        mockedUseChannel.mockReturnValue(flaggedPostChannel);
        mockedUseContentFlaggingConfig.mockReturnValue(defaultContentFlaggingConfig);

        Client4.removeFlaggedPost = jest.fn().mockResolvedValue({});
        Client4.keepFlaggedPost = jest.fn().mockResolvedValue({});
    });

    describe('remove action', () => {
        test('should render modal with remove action content', () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            expect(screen.getByTestId('keep-remove-flagged-message-confirmation-modal')).toBeVisible();
            expect(screen.getByText('Remove message from channel')).toBeVisible();
            expect(screen.getByText('Remove message')).toBeVisible();
        });

        test('should show notification subtext when notify_reporter_on_removal is true', () => {
            mockedUseContentFlaggingConfig.mockReturnValue({
                ...defaultContentFlaggingConfig,
                notify_reporter_on_removal: true,
            });

            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            expect(screen.getByText(/a notification will be sent to the reporter/)).toBeVisible();
        });

        test('should show no notification subtext when notify_reporter_on_removal is false', () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            expect(screen.getByText(/the message will be removed from the channel. This action cannot be reverted./)).toBeVisible();
        });

        test('should call Client4.removeFlaggedPost on confirm', async () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            const confirmButton = screen.getByText('Remove message');
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(Client4.removeFlaggedPost).toHaveBeenCalledWith(flaggedPost.id, '');
            });
            expect(onExited).toHaveBeenCalled();
        });
    });

    describe('keep action', () => {
        test('should render modal with keep action content', () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='keep'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            expect(screen.getByTestId('keep-remove-flagged-message-confirmation-modal')).toBeVisible();
            expect(screen.getByText('Keep message')).toBeVisible();
        });

        test('should show notification subtext when notify_reporter_on_dismissal is true', () => {
            mockedUseContentFlaggingConfig.mockReturnValue({
                ...defaultContentFlaggingConfig,
                notify_reporter_on_dismissal: true,
            });

            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='keep'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            expect(screen.getByText(/a notification will be sent to the reporter/)).toBeVisible();
        });

        test('should show no notification subtext when notify_reporter_on_dismissal is false', () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='keep'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            expect(screen.getByText(/the message will be visible to all channel members./)).toBeVisible();
        });

        test('should call Client4.keepFlaggedPost on confirm', async () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='keep'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            const confirmButton = screen.getByText('Keep message');
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(Client4.keepFlaggedPost).toHaveBeenCalledWith(flaggedPost.id, '');
            });
            expect(onExited).toHaveBeenCalled();
        });
    });

    describe('comment section', () => {
        test('should show optional comment label when reviewer_comment_required is false', () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            expect(screen.getByText('Comment (optional)')).toBeVisible();
        });

        test('should show required comment label when reviewer_comment_required is true', () => {
            mockedUseContentFlaggingConfig.mockReturnValue({
                ...defaultContentFlaggingConfig,
                reviewer_comment_required: true,
            });

            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            expect(screen.getByText('Comment (required)')).toBeVisible();
        });

        test('should show validation error when comment is required but empty on confirm', async () => {
            mockedUseContentFlaggingConfig.mockReturnValue({
                ...defaultContentFlaggingConfig,
                reviewer_comment_required: true,
            });

            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            const confirmButton = screen.getByText('Remove message');
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(screen.getByText('Please add a comment.')).toBeVisible();
            });
            expect(Client4.removeFlaggedPost).not.toHaveBeenCalled();
            expect(onExited).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        test('should show request error when API call fails', async () => {
            const errorMessage = 'Failed to remove flagged post';
            Client4.removeFlaggedPost = jest.fn().mockRejectedValue({message: errorMessage});

            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            const confirmButton = screen.getByText('Remove message');
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(screen.getByText(errorMessage)).toBeVisible();
            });
            expect(onExited).not.toHaveBeenCalled();
        });
    });
});
