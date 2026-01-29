// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    renderWithContext,
    screen,
    fireEvent,
    act,
    userEvent,
    waitFor,
} from 'tests/react_testing_utils';

import NewSearch from './new_search';

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useDispatch: () => mockDispatch,
}));

describe('components/new_search/NewSearch', () => {
    test('should open the search box on click search', async () => {
        renderWithContext(<NewSearch/>);
        expect(screen.queryByText('Messages')).not.toBeInTheDocument();

        await userEvent.click(screen.getByText('Search'));

        expect(screen.getByText('Messages')).toBeInTheDocument();
    });

    test('should open the search box when pressing any key differnt than tab', async () => {
        renderWithContext(<NewSearch/>);
        expect(screen.queryByText('Messages')).not.toBeInTheDocument();

        act(() => {
            screen.getByText('Search').focus();
        });

        expect(screen.queryByText('Messages')).not.toBeInTheDocument();

        await userEvent.type(screen.getByText('Search'), 'a');

        expect(screen.getByText('Messages')).toBeInTheDocument();
    });

    test('should close the search box on click outside the searchbox', async () => {
        renderWithContext(<div><NewSearch/>{'Outside'}</div>);

        expect(screen.queryByText('Messages')).not.toBeInTheDocument();

        await userEvent.click(screen.getByText('Search'));

        expect(screen.getByText('Messages')).toBeInTheDocument();

        await userEvent.click(screen.getByText('Outside'));

        await waitFor(() => {
            expect(screen.queryByText('Messages')).not.toBeInTheDocument();
        });
    });

    test('should close the search box on Esc key is pressed', async () => {
        renderWithContext(<NewSearch/>);

        expect(screen.queryByText('Messages')).not.toBeInTheDocument();

        await userEvent.click(screen.getByText('Search'));

        expect(screen.getByText('Messages')).toBeInTheDocument();

        await userEvent.type(screen.getByPlaceholderText('Search messages'), '{escape}');

        await waitFor(() => {
            expect(screen.queryByText('Messages')).not.toBeInTheDocument();
        });
    });

    test('should close on search after calling dispatch', async () => {
        renderWithContext(<NewSearch/>);

        expect(screen.queryByText('Messages')).not.toBeInTheDocument();

        await userEvent.click(screen.getByText('Search'));

        expect(screen.getByText('Messages')).toBeInTheDocument();

        await userEvent.type(screen.getByPlaceholderText('Search messages'), '{enter}');

        await waitFor(() => {
            expect(screen.queryByText('Messages')).not.toBeInTheDocument();
        });
        expect(mockDispatch).toHaveBeenCalledWith({searchType: 'messages', type: 'UPDATE_RHS_SEARCH_TYPE'});
        expect(mockDispatch).toHaveBeenCalledWith({terms: '', type: 'UPDATE_RHS_SEARCH_TERMS'});
        expect(mockDispatch).toHaveBeenCalledWith({teamId: '', type: 'UPDATE_RHS_SEARCH_TEAM'});
        expect(mockDispatch).toHaveBeenCalledTimes(4);
    });

    test('should open the search ctrl+shift+f is press on web app', async () => {
        renderWithContext(<div><NewSearch/>{'Outside'}</div>);

        expect(screen.queryByText('Messages')).not.toBeInTheDocument();

        // Trigger global keyboard shortcut (Ctrl+Shift+F) to open search from any element - fireEvent used because userEvent.keyboard requires element focus
        await act(() => fireEvent.keyDown(
            screen.getByText('Outside'),
            {key: 'f', code: 'KeyF', keyCode: 70, charCode: 70, ctrlKey: true, shiftKey: true},
        ));

        expect(screen.getByText('Messages')).toBeInTheDocument();
    });

    test('should apply centered styles when isCentered prop is true', async () => {
        renderWithContext(<NewSearch isCentered={true}/>);

        await userEvent.click(screen.getByText('Search'));

        const searchBox = screen.getByLabelText('Search box');
        expect(searchBox).toHaveStyle({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
        });
    });
});
