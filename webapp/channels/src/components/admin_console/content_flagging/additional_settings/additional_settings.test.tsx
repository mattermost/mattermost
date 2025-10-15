// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import type {ContentFlaggingAdditionalSettings} from '@mattermost/types/config';

import {renderWithContext} from 'tests/react_testing_utils';

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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render with initial values', () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        expect(screen.getByText('Additional Settings')).toBeInTheDocument();
        expect(screen.getByText('Configure how you want the flagging to behave')).toBeInTheDocument();
        expect(screen.getByText('Reasons for flagging')).toBeInTheDocument();
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
        expect(screen.getByTestId('requireReporterComment_false')).toBeChecked();
        expect(screen.getByTestId('requireReporterComment_true')).not.toBeChecked();

        // Reviewer comment required - should be true
        expect(screen.getByTestId('requireReviewerComment_true')).toBeChecked();
        expect(screen.getByTestId('requireReviewerComment_false')).not.toBeChecked();

        // Hide flagged posts - should be false
        expect(screen.getByTestId('setHideFlaggedPosts_false')).toBeChecked();
        expect(screen.getByTestId('hideFlaggedPosts_true')).not.toBeChecked();
    });

    test('should call onChange when reporter comment requirement changes', () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        fireEvent.click(screen.getByTestId('requireReporterComment_true'));

        expect(defaultProps.onChange).toHaveBeenCalledWith('ContentFlaggingAdditionalSettings', {
            ...(defaultProps.value as ContentFlaggingAdditionalSettings),
            ReporterCommentRequired: true,
        });
    });

    test('should call onChange when reviewer comment requirement changes', () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        fireEvent.click(screen.getByTestId('requireReviewerComment_false'));

        expect(defaultProps.onChange).toHaveBeenCalledWith('ContentFlaggingAdditionalSettings', {
            ...(defaultProps.value as ContentFlaggingAdditionalSettings),
            ReviewerCommentRequired: false,
        });
    });

    test('should call onChange when hide flagged content setting changes', () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        fireEvent.click(screen.getByTestId('hideFlaggedPosts_true'));

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

        expect(screen.getByText('Reasons for flagging')).toBeInTheDocument();
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

        expect(screen.getByTestId('requireReporterComment_true')).toBeChecked();
        expect(screen.getByTestId('requireReviewerComment_true')).toBeChecked();
        expect(screen.getByTestId('hideFlaggedPosts_true')).toBeChecked();
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

        expect(screen.getByTestId('requireReporterComment_false')).toBeChecked();
        expect(screen.getByTestId('requireReviewerComment_false')).toBeChecked();
        expect(screen.getByTestId('setHideFlaggedPosts_false')).toBeChecked();
    });

    test('should render CreatableReactSelect with correct props', () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        const selectInput = screen.getByRole('combobox');
        expect(selectInput).toBeInTheDocument();
        expect(selectInput).toHaveAttribute('id', 'contentFlaggingReasons');
    });

    test('should maintain state consistency across multiple changes', () => {
        renderWithContext(<ContentFlaggingAdditionalSettingsSection {...defaultProps}/>);

        // Change reporter comment requirement
        fireEvent.click(screen.getByTestId('requireReporterComment_true'));
        expect(defaultProps.onChange).toHaveBeenLastCalledWith('ContentFlaggingAdditionalSettings', {
            ...(defaultProps.value as ContentFlaggingAdditionalSettings),
            ReporterCommentRequired: true,
        });

        // Change hide flagged content
        fireEvent.click(screen.getByTestId('hideFlaggedPosts_true'));
        expect(defaultProps.onChange).toHaveBeenLastCalledWith('ContentFlaggingAdditionalSettings', {
            ...(defaultProps.value as ContentFlaggingAdditionalSettings),
            ReporterCommentRequired: true,
            HideFlaggedContent: true,
        });
    });
});
