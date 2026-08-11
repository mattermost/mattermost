// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type {MockStoreEnhanced} from 'redux-mock-store';

import {ContentFlaggingTypes} from 'mattermost-redux/action_types';
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

    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;

    const mockReportSuccess = () => {
        Client4.generateFlaggedPostReport = jest.fn().mockResolvedValue(new Blob(['report'], {type: 'application/zip'}));
    };

    const mockReportFailure = () => {
        Client4.generateFlaggedPostReport = jest.fn().mockRejectedValue(new Error('boom'));
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockedUseUser.mockReturnValue(flaggedPostAuthor);
        mockedUseChannel.mockReturnValue(flaggedPostChannel);
        mockedUseContentFlaggingConfig.mockReturnValue(
            defaultContentFlaggingConfig,
        );

        Client4.removeFlaggedPost = jest.fn().mockResolvedValue({});
        Client4.keepFlaggedPost = jest.fn().mockResolvedValue({});
        mockReportSuccess();

        originalCreateObjectURL = URL.createObjectURL;
        originalRevokeObjectURL = URL.revokeObjectURL;
        URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
        URL.revokeObjectURL = jest.fn();

        // eslint-disable-next-line no-console
        console.error = jest.fn();
    });

    afterEach(() => {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
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
            expect(screen.getByRole('heading', {name: 'Remove message from channel'})).toBeVisible();

            // Default form step shows the "Continue" primary button (download checkbox is on by default)
            expect(screen.getByRole('button', {name: 'Continue'})).toBeVisible();
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

            const subtext = screen.getByTestId('keep-remove-flagged-message-subtext');
            expect(subtext).toBeVisible();
            expect(subtext).toHaveTextContent(/a notification will be sent to the reporter/);
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

            const subtext = screen.getByTestId('keep-remove-flagged-message-subtext');
            expect(subtext).toBeVisible();
            expect(subtext).toHaveTextContent(/the message will be removed from the channel. This action cannot be reverted./);
        });

        test('should call Client4.removeFlaggedPost via download flow on Remove permanently', async () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            // Form step with checkbox checked → click Continue triggers report fetch
            await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

            await waitFor(() => {
                expect(Client4.generateFlaggedPostReport).toHaveBeenCalledWith(
                    flaggedPost.id,
                    '',
                    'remove',
                    expect.any(AbortSignal),
                );
            });

            await waitFor(() => {
                expect(screen.getByTestId('generated-section')).toBeVisible();
            });

            await userEvent.click(screen.getByRole('button', {name: 'Remove permanently'}));

            await waitFor(() => {
                expect(Client4.removeFlaggedPost).toHaveBeenCalledWith(flaggedPost.id, '');
            });
            expect(onExited).toHaveBeenCalled();
        });

        test('should go through skip-confirm when checkbox is unchecked', async () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            await userEvent.click(screen.getByTestId('download-report-checkbox'));

            // Button label changes to "Remove message" when checkbox unchecked
            await userEvent.click(screen.getByRole('button', {name: 'Remove message'}));

            await waitFor(() => {
                expect(screen.getByTestId('skip-confirm-body')).toBeVisible();
            });

            await userEvent.click(screen.getByRole('button', {name: 'Remove without report'}));

            await waitFor(() => {
                expect(Client4.removeFlaggedPost).toHaveBeenCalledWith(flaggedPost.id, '');
            });
            expect(Client4.generateFlaggedPostReport).not.toHaveBeenCalled();
        });

        test('should show error step when report generation fails and allow retry', async () => {
            mockReportFailure();

            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

            await waitFor(() => {
                expect(screen.getByTestId('error-section')).toBeVisible();
            });

            // Switch to success and retry
            mockReportSuccess();
            await userEvent.click(screen.getByTestId('error-retry-button'));

            await waitFor(() => {
                expect(screen.getByTestId('generated-section')).toBeVisible();
            });
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
            expect(screen.getByRole('button', {name: 'Continue'})).toBeVisible();
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

            const subtext = screen.getByTestId('keep-remove-flagged-message-subtext');
            expect(subtext).toBeVisible();
            expect(subtext).toHaveTextContent(/a notification will be sent to the reporter/);
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

            const subtext = screen.getByTestId('keep-remove-flagged-message-subtext');
            expect(subtext).toBeVisible();
            expect(subtext).toHaveTextContent(/the message will be visible to all channel members./);
        });

        test('should call Client4.keepFlaggedPost via download flow on Keep permanently', async () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='keep'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

            await waitFor(() => {
                expect(screen.getByTestId('generated-section')).toBeVisible();
            });

            await userEvent.click(screen.getByRole('button', {name: 'Keep permanently'}));

            await waitFor(() => {
                expect(Client4.keepFlaggedPost).toHaveBeenCalledWith(flaggedPost.id, '');
            });
            expect(onExited).toHaveBeenCalled();
        });

        test('should call Client4.keepFlaggedPost directly without skip-confirm when checkbox is unchecked', async () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='keep'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            await userEvent.click(screen.getByTestId('download-report-checkbox'));
            await userEvent.click(screen.getByRole('button', {name: 'Keep message'}));

            await waitFor(() => {
                expect(Client4.keepFlaggedPost).toHaveBeenCalledWith(flaggedPost.id, '');
            });
            expect(screen.queryByTestId('skip-confirm-body')).not.toBeInTheDocument();
            expect(Client4.generateFlaggedPostReport).not.toHaveBeenCalled();
        });

        test('skip from generating step calls keepFlaggedPost directly without skip-confirm', async () => {
            Client4.generateFlaggedPostReport = jest.fn().mockReturnValue(new Promise(() => {}));

            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='keep'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

            await waitFor(() => {
                expect(screen.getByTestId('generating-section')).toBeVisible();
            });

            await userEvent.click(screen.getByTestId('generating-skip-button'));

            await waitFor(() => {
                expect(Client4.keepFlaggedPost).toHaveBeenCalledWith(flaggedPost.id, '');
            });
            expect(screen.queryByTestId('skip-confirm-body')).not.toBeInTheDocument();
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

            const commentTitle = screen.getByTestId('keep-remove-flagged-message-comment-title');
            expect(commentTitle).toBeVisible();
            expect(commentTitle).toHaveTextContent('Comment (optional)');
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

            const commentTitle = screen.getByTestId('keep-remove-flagged-message-comment-title');
            expect(commentTitle).toBeVisible();
            expect(commentTitle).toHaveTextContent('Comment (required)');
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

            await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

            await waitFor(() => {
                expect(screen.getByText('Please add a comment.')).toBeVisible();
            });
            expect(Client4.generateFlaggedPostReport).not.toHaveBeenCalled();
            expect(Client4.removeFlaggedPost).not.toHaveBeenCalled();
            expect(onExited).not.toHaveBeenCalled();
        });
    });

    describe('step transitions', () => {
        test('should pass typed comment to action API', async () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            await userEvent.type(screen.getByPlaceholderText('Add your comment here'), 'looks fine');
            await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

            await waitFor(() => {
                expect(screen.getByTestId('generated-section')).toBeVisible();
            });
            await userEvent.click(screen.getByRole('button', {name: 'Remove permanently'}));

            await waitFor(() => {
                expect(Client4.removeFlaggedPost).toHaveBeenCalledWith(flaggedPost.id, 'looks fine');
            });
        });

        test('clicking "Download again" on generated step retriggers report fetch', async () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
            await waitFor(() => {
                expect(screen.getByTestId('generated-section')).toBeVisible();
            });
            const initialCallCount = (Client4.generateFlaggedPostReport as jest.Mock).mock.calls.length;

            await userEvent.click(screen.getByTestId('generated-download-again-button'));

            await waitFor(() => {
                expect((Client4.generateFlaggedPostReport as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
            });
            await waitFor(() => {
                expect(screen.getByTestId('generated-section')).toBeVisible();
            });
        });

        test('skip from generating step routes to skip-confirm', async () => {
            // Hold the request open so we can interact with the generating footer
            Client4.generateFlaggedPostReport = jest.fn().mockReturnValue(new Promise(() => {}));

            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

            await waitFor(() => {
                expect(screen.getByTestId('generating-section')).toBeVisible();
            });

            await userEvent.click(screen.getByTestId('generating-skip-button'));

            await waitFor(() => {
                expect(screen.getByTestId('skip-confirm-body')).toBeVisible();
            });
            expect(screen.queryByTestId('generated-section')).not.toBeInTheDocument();
        });

        test('back from skip-confirm returns to form step', async () => {
            renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
            );

            await userEvent.click(screen.getByTestId('download-report-checkbox'));
            await userEvent.click(screen.getByRole('button', {name: 'Remove message'}));

            await waitFor(() => {
                expect(screen.getByTestId('skip-confirm-body')).toBeVisible();
            });

            await userEvent.click(screen.getByTestId('skip-confirm-back-button'));

            await waitFor(() => {
                expect(screen.getByRole('button', {name: 'Remove message'})).toBeVisible();
            });
        });
    });

    describe('store cleanup after remove', () => {
        test('dispatches FLAGGED_POST_REMOVED after a successful removeFlaggedPost call', async () => {
            const {store} = renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
                {},
                {useMockedStore: true},
            );

            await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

            await waitFor(() => {
                expect(screen.getByTestId('generated-section')).toBeVisible();
            });

            await userEvent.click(screen.getByRole('button', {name: 'Remove permanently'}));

            await waitFor(() => {
                expect(Client4.removeFlaggedPost).toHaveBeenCalledWith(flaggedPost.id, '');
            });

            await waitFor(() => {
                expect((store as unknown as MockStoreEnhanced).getActions()).toContainEqual({
                    type: ContentFlaggingTypes.FLAGGED_POST_REMOVED,
                    data: {postId: flaggedPost.id},
                });
            });
        });

        test('does not dispatch FLAGGED_POST_REMOVED when removeFlaggedPost fails', async () => {
            Client4.removeFlaggedPost = jest.fn().mockRejectedValue({message: 'boom'});

            const {store} = renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='remove'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
                {},
                {useMockedStore: true},
            );

            await userEvent.click(screen.getByTestId('download-report-checkbox'));
            await userEvent.click(screen.getByRole('button', {name: 'Remove message'}));

            await waitFor(() => {
                expect(screen.getByTestId('skip-confirm-body')).toBeVisible();
            });

            await userEvent.click(screen.getByRole('button', {name: 'Remove without report'}));

            await waitFor(() => {
                expect(Client4.removeFlaggedPost).toHaveBeenCalledWith(flaggedPost.id, '');
            });

            expect((store as unknown as MockStoreEnhanced).getActions()).not.toContainEqual(
                expect.objectContaining({type: ContentFlaggingTypes.FLAGGED_POST_REMOVED}),
            );
        });

        test('does not dispatch FLAGGED_POST_REMOVED for keep action', async () => {
            const {store} = renderWithContext(
                <KeepRemoveFlaggedMessageConfirmationModal
                    action='keep'
                    onExited={onExited}
                    flaggedPost={flaggedPost}
                    reportingUser={reportingUser}
                />,
                {},
                {useMockedStore: true},
            );

            await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

            await waitFor(() => {
                expect(screen.getByTestId('generated-section')).toBeVisible();
            });

            await userEvent.click(screen.getByRole('button', {name: 'Keep permanently'}));

            await waitFor(() => {
                expect(Client4.keepFlaggedPost).toHaveBeenCalledWith(flaggedPost.id, '');
            });

            expect((store as unknown as MockStoreEnhanced).getActions()).not.toContainEqual(
                expect.objectContaining({type: ContentFlaggingTypes.FLAGGED_POST_REMOVED}),
            );
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

            // Skip download path so we go directly to API call
            await userEvent.click(screen.getByTestId('download-report-checkbox'));
            await userEvent.click(screen.getByRole('button', {name: 'Remove message'}));

            await waitFor(() => {
                expect(screen.getByTestId('skip-confirm-body')).toBeVisible();
            });

            await userEvent.click(screen.getByRole('button', {name: 'Remove without report'}));

            await waitFor(() => {
                const errorElement = screen.getByTestId(
                    'keep-remove-flagged-message-request-error',
                );
                expect(errorElement).toBeVisible();
                expect(errorElement).toHaveTextContent(errorMessage);
            });
            expect(onExited).not.toHaveBeenCalled();
        });
    });
});
