// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    renderWithContext,
    screen,
    fireEvent,
    act,
} from 'tests/react_testing_utils';

import NewSearch from './new_search';

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useDispatch: () => mockDispatch,
}));

describe('components/new_search/NewSearch', () => {
    test('should open the search box on click search', () => {
        renderWithContext(<NewSearch/>);
        expect(screen.queryByText('Messages')).not.toBeInTheDocument();
        screen.getByText('Search').click();
        expect(screen.getByText('Messages')).toBeInTheDocument();
    });

    test('should open the search box when pressing any key differnt than tab', () => {
        renderWithContext(<NewSearch/>);
        expect(screen.queryByText('Messages')).not.toBeInTheDocument();
        fireEvent.keyDown(screen.getByText('Search'), {key: 'Tab', code: 'Tab', keyCode: 9, charCode: 9});
        expect(screen.queryByText('Messages')).not.toBeInTheDocument();
        fireEvent.keyDown(screen.getByText('Search'), {key: 'a', code: 'KeyA', keyCode: 65, charCode: 65});
        expect(screen.getByText('Messages')).toBeInTheDocument();
    });

    test('should close the search box on click outside the searchbox', () => {
        renderWithContext(<div><NewSearch/>{'Outside'}</div>);
        expect(screen.queryByText('Messages')).not.toBeInTheDocument();
        act(() => {
            screen.getByText('Search').click();
        });
        expect(screen.getByText('Messages')).toBeInTheDocument();
        act(() => {
            screen.getByText('Outside').click();
        });
        expect(screen.queryByText('Messages')).not.toBeInTheDocument();
    });

    test('should close the search box on Esc key is pressed', () => {
        renderWithContext(<NewSearch/>);
        expect(screen.queryByText('Messages')).not.toBeInTheDocument();
        act(() => {
            screen.getByText('Search').click();
        });
        expect(screen.getByText('Messages')).toBeInTheDocument();
        act(() => {
            fireEvent.keyDown(screen.getByPlaceholderText('Search messages'), {key: 'Escape', code: 'Escape', keyCode: 27, charCode: 27});
        });
        expect(screen.queryByText('Messages')).not.toBeInTheDocument();
    });

    test('should close on search after calling dispatch', () => {
        renderWithContext(<NewSearch/>);
        expect(screen.queryByText('Messages')).not.toBeInTheDocument();
        act(() => {
            screen.getByText('Search').click();
        });
        expect(screen.getByText('Messages')).toBeInTheDocument();
        act(() => {
            fireEvent.keyDown(screen.getByPlaceholderText('Search messages'), {key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13});
        });
        expect(screen.queryByText('Messages')).not.toBeInTheDocument();
        expect(mockDispatch).toHaveBeenCalledWith({searchType: 'messages', type: 'UPDATE_RHS_SEARCH_TYPE'});
        expect(mockDispatch).toHaveBeenCalledWith({terms: '', type: 'UPDATE_RHS_SEARCH_TERMS'});
        expect(mockDispatch).toHaveBeenCalledWith({teamId: '', type: 'UPDATE_RHS_SEARCH_TEAM'});
        expect(mockDispatch).toHaveBeenCalledTimes(4);
    });

    test('should open the search ctrl+shift+f is press on web app', () => {
        renderWithContext(<div><NewSearch/>{'Outside'}</div>);
        expect(screen.queryByText('Messages')).not.toBeInTheDocument();
        act(() => {
            fireEvent.keyDown(screen.getByText('Outside'), {key: 'f', code: 'KeyF', keyCode: 70, charCode: 70, ctrlKey: true, shiftKey: true});
        });
        expect(screen.getByText('Messages')).toBeInTheDocument();
    });
});
