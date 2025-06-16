// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {IntlProvider} from 'react-intl';

import type {ContentFlaggingNotificationSettings} from '@mattermost/types/config';

import ContentFlaggingNotificationSettingsSection from './notification_settings';

const renderWithIntl = (component: React.ReactElement) => {
    return render(
        <IntlProvider locale="en">
            {component}
        </IntlProvider>
    );
};

describe('ContentFlaggingNotificationSettingsSection', () => {
    const defaultProps = {
        id: 'test-id',
        value: {
            EventTargetMapping: {
                flagged: ['reviewers'],
                assigned: ['reviewers'],
                removed: ['reviewers', 'author'],
                dismissed: ['reviewers'],
            },
        } as ContentFlaggingNotificationSettings,
        onChange: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render section title and description', () => {
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...defaultProps}/>);
        
        expect(screen.getByText('Notification Settings')).toBeInTheDocument();
        expect(screen.getByText('Choose who receives notifications from the System bot when content is flagged and reviewed')).toBeInTheDocument();
    });

    test('should render all notification setting sections', () => {
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...defaultProps}/>);
        
        expect(screen.getByText('Notify when content is flagged')).toBeInTheDocument();
        expect(screen.getByText('Notify when a reviewer is assigned')).toBeInTheDocument();
        expect(screen.getByText('Notify when content is removed')).toBeInTheDocument();
        expect(screen.getByText('Notify when flag is dismissed')).toBeInTheDocument();
    });

    test('should render all checkbox labels', () => {
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...defaultProps}/>);
        
        // Should have multiple instances of these labels across different sections
        expect(screen.getAllByText('Reviewer(s)')).toHaveLength(4);
        expect(screen.getAllByText('Author')).toHaveLength(3);
        expect(screen.getAllByText('Reporter')).toHaveLength(2);
    });

    test('should set correct default checked values for checkboxes', () => {
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...defaultProps}/>);
        
        // Flagged section
        expect(screen.getByRole('checkbox', {name: /flagged_reviewers/})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: /flagged_authors/})).not.toBeChecked();
        
        // Assigned section
        expect(screen.getByRole('checkbox', {name: /assigned_reviewers/})).toBeChecked();
        
        // Removed section
        expect(screen.getByRole('checkbox', {name: /removed_reviewers/})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: /removed_author/})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: /removed_reporter/})).not.toBeChecked();
        
        // Dismissed section
        expect(screen.getByRole('checkbox', {name: /dismissed_reviewers/})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: /dismissed_author/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /dismissed_reporter/})).not.toBeChecked();
    });

    test('should handle checkbox change when adding a target', () => {
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...defaultProps}/>);
        
        const flaggedAuthorsCheckbox = screen.getByRole('checkbox', {name: /flagged_authors/});
        fireEvent.click(flaggedAuthorsCheckbox);
        
        expect(defaultProps.onChange).toHaveBeenCalledWith('test-id', {
            EventTargetMapping: {
                flagged: ['reviewers', 'authors'],
                assigned: ['reviewers'],
                removed: ['reviewers', 'author'],
                dismissed: ['reviewers'],
            },
        });
    });

    test('should handle checkbox change when removing a target', () => {
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...defaultProps}/>);
        
        const removedAuthorCheckbox = screen.getByRole('checkbox', {name: /removed_author/});
        fireEvent.click(removedAuthorCheckbox);
        
        expect(defaultProps.onChange).toHaveBeenCalledWith('test-id', {
            EventTargetMapping: {
                flagged: ['reviewers'],
                assigned: ['reviewers'],
                removed: ['reviewers'],
                dismissed: ['reviewers'],
            },
        });
    });

    test('should disable flagged_reviewers checkbox', () => {
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...defaultProps}/>);
        
        const flaggedReviewersCheckbox = screen.getByRole('checkbox', {name: /flagged_reviewers/});
        expect(flaggedReviewersCheckbox).toBeDisabled();
    });

    test('should not disable other checkboxes', () => {
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...defaultProps}/>);
        
        expect(screen.getByRole('checkbox', {name: /flagged_authors/})).not.toBeDisabled();
        expect(screen.getByRole('checkbox', {name: /assigned_reviewers/})).not.toBeDisabled();
        expect(screen.getByRole('checkbox', {name: /removed_reviewers/})).not.toBeDisabled();
        expect(screen.getByRole('checkbox', {name: /removed_author/})).not.toBeDisabled();
        expect(screen.getByRole('checkbox', {name: /removed_reporter/})).not.toBeDisabled();
        expect(screen.getByRole('checkbox', {name: /dismissed_reviewers/})).not.toBeDisabled();
        expect(screen.getByRole('checkbox', {name: /dismissed_author/})).not.toBeDisabled();
        expect(screen.getByRole('checkbox', {name: /dismissed_reporter/})).not.toBeDisabled();
    });

    test('should initialize EventTargetMapping if not present', () => {
        const propsWithoutMapping = {
            ...defaultProps,
            value: {} as ContentFlaggingNotificationSettings,
        };
        
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...propsWithoutMapping}/>);
        
        const flaggedReviewersCheckbox = screen.getByRole('checkbox', {name: /flagged_reviewers/});
        fireEvent.click(flaggedReviewersCheckbox);
        
        expect(defaultProps.onChange).toHaveBeenCalledWith('test-id', {
            EventTargetMapping: {
                flagged: ['reviewers'],
                assigned: [],
                removed: [],
                dismissed: [],
            },
        });
    });

    test('should initialize action array if not present', () => {
        const propsWithPartialMapping = {
            ...defaultProps,
            value: {
                EventTargetMapping: {
                    flagged: ['reviewers'],
                    // missing assigned, removed, dismissed
                },
            } as ContentFlaggingNotificationSettings,
        };
        
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...propsWithPartialMapping}/>);
        
        const assignedReviewersCheckbox = screen.getByRole('checkbox', {name: /assigned_reviewers/});
        fireEvent.click(assignedReviewersCheckbox);
        
        expect(defaultProps.onChange).toHaveBeenCalledWith('test-id', {
            EventTargetMapping: {
                flagged: ['reviewers'],
                assigned: ['reviewers'],
            },
        });
    });

    test('should not add duplicate targets', () => {
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...defaultProps}/>);
        
        // Try to add 'reviewers' to flagged again (it's already there)
        const flaggedReviewersCheckbox = screen.getByRole('checkbox', {name: /flagged_reviewers/});
        fireEvent.click(flaggedReviewersCheckbox);
        
        expect(defaultProps.onChange).toHaveBeenCalledWith('test-id', {
            EventTargetMapping: {
                flagged: ['reviewers'], // Should remain the same, no duplicate
                assigned: ['reviewers'],
                removed: ['reviewers', 'author'],
                dismissed: ['reviewers'],
            },
        });
    });

    test('should handle multiple checkbox changes correctly', () => {
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...defaultProps}/>);
        
        // First change: add author to flagged
        const flaggedAuthorsCheckbox = screen.getByRole('checkbox', {name: /flagged_authors/});
        fireEvent.click(flaggedAuthorsCheckbox);
        
        // Second change: add reporter to removed
        const removedReporterCheckbox = screen.getByRole('checkbox', {name: /removed_reporter/});
        fireEvent.click(removedReporterCheckbox);
        
        expect(defaultProps.onChange).toHaveBeenCalledTimes(2);
        
        expect(defaultProps.onChange).toHaveBeenNthCalledWith(1, 'test-id', {
            EventTargetMapping: {
                flagged: ['reviewers', 'authors'],
                assigned: ['reviewers'],
                removed: ['reviewers', 'author'],
                dismissed: ['reviewers'],
            },
        });
        
        expect(defaultProps.onChange).toHaveBeenNthCalledWith(2, 'test-id', {
            EventTargetMapping: {
                flagged: ['reviewers', 'authors'],
                assigned: ['reviewers'],
                removed: ['reviewers', 'author', 'reporter'],
                dismissed: ['reviewers'],
            },
        });
    });

    test('should handle unchecking and rechecking the same checkbox', () => {
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...defaultProps}/>);
        
        const removedAuthorCheckbox = screen.getByRole('checkbox', {name: /removed_author/});
        
        // First click: uncheck (remove author from removed)
        fireEvent.click(removedAuthorCheckbox);
        expect(defaultProps.onChange).toHaveBeenNthCalledWith(1, 'test-id', {
            EventTargetMapping: {
                flagged: ['reviewers'],
                assigned: ['reviewers'],
                removed: ['reviewers'],
                dismissed: ['reviewers'],
            },
        });
        
        // Second click: check again (add author back to removed)
        fireEvent.click(removedAuthorCheckbox);
        expect(defaultProps.onChange).toHaveBeenNthCalledWith(2, 'test-id', {
            EventTargetMapping: {
                flagged: ['reviewers'],
                assigned: ['reviewers'],
                removed: ['reviewers', 'author'],
                dismissed: ['reviewers'],
            },
        });
        
        expect(defaultProps.onChange).toHaveBeenCalledTimes(2);
    });

    test('should handle empty EventTargetMapping arrays', () => {
        const propsWithEmptyArrays = {
            ...defaultProps,
            value: {
                EventTargetMapping: {
                    flagged: [],
                    assigned: [],
                    removed: [],
                    dismissed: [],
                },
            } as ContentFlaggingNotificationSettings,
        };
        
        renderWithIntl(<ContentFlaggingNotificationSettingsSection {...propsWithEmptyArrays}/>);
        
        // All checkboxes should be unchecked
        expect(screen.getByRole('checkbox', {name: /flagged_reviewers/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /flagged_authors/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /assigned_reviewers/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /removed_reviewers/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /removed_author/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /removed_reporter/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /dismissed_reviewers/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /dismissed_author/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /dismissed_reporter/})).not.toBeChecked();
    });
});
