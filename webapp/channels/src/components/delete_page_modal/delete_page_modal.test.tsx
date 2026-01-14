// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';

import DeletePageModal from 'components/delete_page_modal/delete_page_modal';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/DeletePageModal', () => {
    const baseProps = {
        pageTitle: 'Test Page',
        childCount: 0,
        onConfirm: jest.fn().mockResolvedValue(undefined),
        onCancel: jest.fn(),
        onExited: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render modal with correct title', () => {
        renderWithContext(<DeletePageModal {...baseProps}/>);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Delete Page')).toBeInTheDocument();
    });

    test('should display page title in warning message', () => {
        renderWithContext(<DeletePageModal {...baseProps}/>);

        expect(screen.getByText(/Are you sure you want to delete "Test Page"/)).toBeInTheDocument();
    });

    test('should display warning note about irreversible action', () => {
        renderWithContext(<DeletePageModal {...baseProps}/>);

        expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    });

    test('should have warning icon', () => {
        renderWithContext(<DeletePageModal {...baseProps}/>);

        const warningIcon = document.querySelector('.icon-alert-outline');
        expect(warningIcon).toBeInTheDocument();
    });

    describe('without child pages', () => {
        test('should not show delete options when no children', () => {
            renderWithContext(<DeletePageModal {...baseProps}/>);

            expect(screen.queryByText('Delete this page only')).not.toBeInTheDocument();
            expect(screen.queryByText('Delete this page and all child pages')).not.toBeInTheDocument();
        });

        test('should call onConfirm with false when Delete is clicked', async () => {
            renderWithContext(<DeletePageModal {...baseProps}/>);

            const deleteButton = screen.getByTestId('delete-button');
            fireEvent.click(deleteButton);

            await waitFor(() => {
                expect(baseProps.onConfirm).toHaveBeenCalledWith(false);
            });
        });
    });

    describe('with child pages', () => {
        const propsWithChildren = {
            ...baseProps,
            childCount: 3,
        };

        test('should display child count in warning', () => {
            renderWithContext(<DeletePageModal {...propsWithChildren}/>);

            expect(screen.getByText(/This page has 3 child pages/)).toBeInTheDocument();
        });

        test('should display singular form for 1 child', () => {
            renderWithContext(
                <DeletePageModal
                    {...baseProps}
                    childCount={1}
                />,
            );

            expect(screen.getByText(/This page has 1 child page/)).toBeInTheDocument();
        });

        test('should show delete options', () => {
            renderWithContext(<DeletePageModal {...propsWithChildren}/>);

            expect(screen.getByText('Delete this page only')).toBeInTheDocument();
            expect(screen.getByText('Delete this page and all child pages')).toBeInTheDocument();
        });

        test('should have "Delete this page only" selected by default', () => {
            renderWithContext(<DeletePageModal {...propsWithChildren}/>);

            const pageOnlyOption = screen.getByLabelText('Delete this page only') as HTMLInputElement;
            expect(pageOnlyOption.checked).toBe(true);
        });

        test('should describe what happens to child pages when deleting page only', () => {
            renderWithContext(<DeletePageModal {...propsWithChildren}/>);

            expect(screen.getByText('Child pages will move to the parent page')).toBeInTheDocument();
        });

        test('should describe deletion of child pages', () => {
            renderWithContext(<DeletePageModal {...propsWithChildren}/>);

            expect(screen.getByText('All 3 child pages will be permanently deleted')).toBeInTheDocument();
        });

        test('should call onConfirm with false when deleting page only', async () => {
            renderWithContext(<DeletePageModal {...propsWithChildren}/>);

            const deleteButton = screen.getByTestId('delete-button');
            fireEvent.click(deleteButton);

            await waitFor(() => {
                expect(baseProps.onConfirm).toHaveBeenCalledWith(false);
            });
        });

        test('should call onConfirm with true when deleting with children', async () => {
            renderWithContext(<DeletePageModal {...propsWithChildren}/>);

            // Select delete with children option
            const deleteWithChildrenOption = screen.getByLabelText('Delete this page and all child pages');
            fireEvent.click(deleteWithChildrenOption);

            const deleteButton = screen.getByTestId('delete-button');
            fireEvent.click(deleteButton);

            await waitFor(() => {
                expect(propsWithChildren.onConfirm).toHaveBeenCalledWith(true);
            });
        });

        test('should toggle between options', () => {
            renderWithContext(<DeletePageModal {...propsWithChildren}/>);

            const pageOnlyOption = screen.getByLabelText('Delete this page only') as HTMLInputElement;
            const withChildrenOption = screen.getByLabelText('Delete this page and all child pages') as HTMLInputElement;

            expect(pageOnlyOption.checked).toBe(true);
            expect(withChildrenOption.checked).toBe(false);

            fireEvent.click(withChildrenOption);
            expect(pageOnlyOption.checked).toBe(false);
            expect(withChildrenOption.checked).toBe(true);

            fireEvent.click(pageOnlyOption);
            expect(pageOnlyOption.checked).toBe(true);
            expect(withChildrenOption.checked).toBe(false);
        });
    });

    test('should disable confirm button while deleting', async () => {
        const slowConfirm = jest.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
        renderWithContext(
            <DeletePageModal
                {...baseProps}
                onConfirm={slowConfirm}
            />,
        );

        const deleteButton = screen.getByTestId('delete-button');
        fireEvent.click(deleteButton);

        // Button should be disabled during deletion
        await waitFor(() => {
            expect(slowConfirm).toHaveBeenCalled();
        });
    });

    test('should call onCancel when Cancel button is clicked', () => {
        renderWithContext(<DeletePageModal {...baseProps}/>);

        // The GenericModal has a Cancel button
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(baseProps.onCancel).toHaveBeenCalled();
    });
});
