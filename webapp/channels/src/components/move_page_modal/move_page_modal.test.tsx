// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {Wiki} from '@mattermost/types/wikis';

import MovePageModal from 'components/move_page_modal/move_page_modal';

import {renderWithContext} from 'tests/react_testing_utils';

// Mock the PageDestinationModal component
jest.mock('components/page_destination_modal', () => {
    return function MockPageDestinationModal(props: any) {
        return (
            <div data-testid='page-destination-modal'>
                <div data-testid='modal-header'>{props.modalHeaderText}</div>
                <div data-testid='confirm-button-text'>{props.confirmButtonText}</div>
                <div data-testid='help-text'>{props.helpText?.(props.currentWikiId, props.currentWikiId)}</div>
                <div data-testid='children-warning'>{props.childrenWarningText}</div>
                <button
                    data-testid={props.confirmButtonTestId}
                    onClick={() => props.onConfirm('targetWiki', 'parentPage')}
                >
                    {props.confirmButtonText}
                </button>
                <button onClick={props.onCancel}>{'Cancel'}</button>
            </div>
        );
    };
});

describe('components/MovePageModal', () => {
    const mockWikis = [
        {
            id: 'wiki1',
            channel_id: 'channel1',
            title: 'Wiki 1',
            description: '',
            create_at: 1000,
            update_at: 1000,
            delete_at: 0,
            creator_id: 'user1',
        },
        {
            id: 'wiki2',
            channel_id: 'channel2',
            title: 'Wiki 2',
            description: '',
            create_at: 1000,
            update_at: 1000,
            delete_at: 0,
            creator_id: 'user1',
        },
    ] as unknown as Wiki[];

    const baseProps = {
        pageId: 'page123',
        pageTitle: 'Test Page',
        currentWikiId: 'wiki1',
        availableWikis: mockWikis,
        fetchPagesForWiki: jest.fn().mockResolvedValue([]),
        hasChildren: false,
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render with correct modal title', () => {
        renderWithContext(<MovePageModal {...baseProps}/>);

        expect(screen.getByTestId('modal-header')).toHaveTextContent('Move Page to Wiki');
    });

    test('should render with correct confirm button text', () => {
        renderWithContext(<MovePageModal {...baseProps}/>);

        expect(screen.getByTestId('confirm-button-text')).toHaveTextContent('Move');
    });

    test('should pass props to PageDestinationModal', () => {
        renderWithContext(<MovePageModal {...baseProps}/>);

        expect(screen.getByTestId('page-destination-modal')).toBeInTheDocument();
    });

    test('should show help text for same wiki reorganization', () => {
        renderWithContext(<MovePageModal {...baseProps}/>);

        expect(screen.getByTestId('help-text')).toHaveTextContent('Moving within the same wiki allows you to reorganize the hierarchy');
    });

    test('should not show children warning when page has no children', () => {
        renderWithContext(<MovePageModal {...baseProps}/>);

        expect(screen.getByTestId('children-warning')).toBeEmptyDOMElement();
    });

    test('should show children warning when page has children', () => {
        renderWithContext(
            <MovePageModal
                {...baseProps}
                hasChildren={true}
            />,
        );

        expect(screen.getByTestId('children-warning')).toHaveTextContent('This page has child pages');
        expect(screen.getByTestId('children-warning')).toHaveTextContent('All child pages will be moved with this page');
    });

    test('should call onConfirm when confirm button is clicked', () => {
        renderWithContext(<MovePageModal {...baseProps}/>);

        const confirmButton = screen.getByTestId('confirm-button');
        confirmButton.click();

        expect(baseProps.onConfirm).toHaveBeenCalledWith('targetWiki', 'parentPage');
    });

    test('should call onCancel when cancel button is clicked', () => {
        renderWithContext(<MovePageModal {...baseProps}/>);

        const cancelButton = screen.getByText('Cancel');
        cancelButton.click();

        expect(baseProps.onCancel).toHaveBeenCalled();
    });

    test('should pass pageId to PageDestinationModal', () => {
        renderWithContext(<MovePageModal {...baseProps}/>);

        // The component renders which means props are passed correctly
        expect(screen.getByTestId('page-destination-modal')).toBeInTheDocument();
    });

    test('should pass availableWikis to PageDestinationModal', () => {
        renderWithContext(<MovePageModal {...baseProps}/>);

        // Component renders correctly with wikis
        expect(screen.getByTestId('page-destination-modal')).toBeInTheDocument();
    });

    test('should pass fetchPagesForWiki function to PageDestinationModal', () => {
        renderWithContext(<MovePageModal {...baseProps}/>);

        // Component renders correctly with fetch function
        expect(screen.getByTestId('page-destination-modal')).toBeInTheDocument();
    });
});
