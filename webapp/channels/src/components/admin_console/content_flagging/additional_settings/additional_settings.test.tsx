// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ContentFlaggingAdditionalSettings} from '@mattermost/types/config';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ContentFlaggingAdditionalSettingsSection from './additional_settings';

describe('ContentFlaggingAdditionalSettingsSection', () => {
    const defaultProps = {
        id: 'ContentFlaggingAdditionalSettings',
        onChange: jest.fn(),
        value: {
            Reasons: ['Spam', 'Inappropriate'],
            ReporterCommentRequired: false,
            ReviewerCommentRequired: true,
            HideFlaggedContent: false,
        } as ContentFlaggingAdditionalSettings,
    };

    test('should render with initial values', () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        expect(screen.getByText('Additional Settings')).toBeInTheDocument();
        expect(screen.getByText('Configure how you want the quarantine to behave')).toBeInTheDocument();
        expect(screen.getByText('Reasons for quarantine')).toBeInTheDocument();
        expect(screen.getByText('Require reporters to add comment')).toBeInTheDocument();
        expect(screen.getByText('Require reviewers to add comment')).toBeInTheDocument();
        expect(screen.getByText('Hide message from channel while it is being reviewed')).toBeInTheDocument();
    });

    test('should render initial reason options', () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        expect(screen.getByText('Spam')).toBeInTheDocument();
        expect(screen.getByText('Inappropriate')).toBeInTheDocument();
    });

    test('should have correct initial radio button states', () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        // Reporter comment required - should be false
        expect(screen.getByTestId('admin.content_flagging.additional.require_reporter_comment.false--radio')).toBeChecked();
        expect(screen.getByTestId('admin.content_flagging.additional.require_reporter_comment.true--radio')).not.toBeChecked();

        // Reviewer comment required - should be true
        expect(screen.getByTestId('admin.content_flagging.additional.require_reviewer_comment.true--radio')).toBeChecked();
        expect(screen.getByTestId('admin.content_flagging.additional.require_reviewer_comment.false--radio')).not.toBeChecked();

        // Hide flagged posts - should be false
        expect(screen.getByTestId('admin.content_flagging.additional.hide_flagged_posts.false--radio')).toBeChecked();
        expect(screen.getByTestId('admin.content_flagging.additional.hide_flagged_posts.true--radio')).not.toBeChecked();
    });

    test('should call onChange when reporter comment requirement changes', async () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        await userEvent.click(screen.getByTestId('admin.content_flagging.additional.require_reporter_comment.true--radio'));

        expect(defaultProps.onChange).toHaveBeenCalledWith('ContentFlaggingAdditionalSettings', {
            ...(defaultProps.value as ContentFlaggingAdditionalSettings),
            ReporterCommentRequired: true,
        });
    });

    test('should call onChange when reviewer comment requirement changes', async () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        await userEvent.click(screen.getByTestId('admin.content_flagging.additional.require_reviewer_comment.false--radio'));

        expect(defaultProps.onChange).toHaveBeenCalledWith('ContentFlaggingAdditionalSettings', {
            ...(defaultProps.value as ContentFlaggingAdditionalSettings),
            ReviewerCommentRequired: false,
        });
    });

    test('should call onChange when hide flagged content setting changes', async () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        await userEvent.click(screen.getByTestId('admin.content_flagging.additional.hide_flagged_posts.true--radio'));

        expect(defaultProps.onChange).toHaveBeenCalledWith('ContentFlaggingAdditionalSettings', {
            ...(defaultProps.value as ContentFlaggingAdditionalSettings),
            HideFlaggedContent: true,
        });
    });

    test('should handle empty reasons array', () => {
        const propsWithEmptyReasons = {
            ...defaultProps,
            value: {
                ...(defaultProps.value as ContentFlaggingAdditionalSettings),
                Reasons: [],
            },
        };

        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...propsWithEmptyReasons}/>);

        expect(screen.getByText('Reasons for quarantine')).toBeInTheDocument();
        expect(screen.queryByText('Spam')).not.toBeInTheDocument();
        expect(screen.queryByText('Inappropriate')).not.toBeInTheDocument();
    });

    test('should handle all boolean settings as true', () => {
        const propsAllTrue = {
            ...defaultProps,
            value: {
                ...(defaultProps.value as ContentFlaggingAdditionalSettings),
                ReporterCommentRequired: true,
                ReviewerCommentRequired: true,
                HideFlaggedContent: true,
            },
        };

        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...propsAllTrue}/>);

        expect(screen.getByTestId('admin.content_flagging.additional.require_reporter_comment.true--radio')).toBeChecked();
        expect(screen.getByTestId('admin.content_flagging.additional.require_reviewer_comment.true--radio')).toBeChecked();
        expect(screen.getByTestId('admin.content_flagging.additional.hide_flagged_posts.true--radio')).toBeChecked();
    });

    test('should handle all boolean settings as false', () => {
        const propsAllFalse = {
            ...defaultProps,
            value: {
                ...(defaultProps.value as ContentFlaggingAdditionalSettings),
                ReporterCommentRequired: false,
                ReviewerCommentRequired: false,
                HideFlaggedContent: false,
            },
        };

        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...propsAllFalse}/>);

        expect(screen.getByTestId('admin.content_flagging.additional.require_reporter_comment.false--radio')).toBeChecked();
        expect(screen.getByTestId('admin.content_flagging.additional.require_reviewer_comment.false--radio')).toBeChecked();
        expect(screen.getByTestId('admin.content_flagging.additional.hide_flagged_posts.false--radio')).toBeChecked();
    });

    test('should render CreatableReactSelect with correct props', () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        const selectInput = screen.getByRole('combobox');
        expect(selectInput).toBeInTheDocument();
        expect(selectInput).toHaveAttribute('id', 'contentFlaggingReasons');
    });

    test('should maintain state consistency across multiple changes', async () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        // Change reporter comment requirement
        await userEvent.click(screen.getByTestId('admin.content_flagging.additional.require_reporter_comment.true--radio'));
        expect(defaultProps.onChange).toHaveBeenLastCalledWith('ContentFlaggingAdditionalSettings', {
            ...(defaultProps.value as ContentFlaggingAdditionalSettings),
            ReporterCommentRequired: true,
        });

        // Change hide flagged content
        await userEvent.click(screen.getByTestId('admin.content_flagging.additional.hide_flagged_posts.true--radio'));
        expect(defaultProps.onChange).toHaveBeenLastCalledWith('ContentFlaggingAdditionalSettings', {
            ...(defaultProps.value as ContentFlaggingAdditionalSettings),
            ReporterCommentRequired: true,
            HideFlaggedContent: true,
        });
    });
});
