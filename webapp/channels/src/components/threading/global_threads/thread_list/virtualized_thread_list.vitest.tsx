// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithIntl, screen} from 'tests/vitest_react_testing_utils';

import VirtualizedThreadList from './virtualized_thread_list';

// Mock AutoSizer to provide dimensions in JSDOM
vi.mock('react-virtualized-auto-sizer', () => ({
    default: ({children}: {children: (size: {height: number; width: number}) => React.ReactNode}) => (
        <div data-testid='auto-sizer'>
            {children({height: 500, width: 350})}
        </div>
    ),
}));

// Mock the Row component to simplify testing
vi.mock('./virtualized_thread_list_row', () => ({
    default: ({data, index, style}: {data: {ids: string[]; selectedThreadId?: string}; index: number; style: React.CSSProperties}) => (
        <div
            data-testid={`thread-row-${data.ids[index]}`}
            style={style}
        >
            {`Thread ${data.ids[index]}`}
            {data.selectedThreadId === data.ids[index] && ' (selected)'}
        </div>
    ),
}));

describe('components/threading/global_threads/thread_list/virtualized_thread_list', () => {
    let props: ComponentProps<typeof VirtualizedThreadList>;
    let loadMoreItems: (startIndex: number, stopIndex: number) => Promise<any>;

    beforeEach(() => {
        loadMoreItems = vi.fn().mockResolvedValue(undefined);

        props = {
            ids: ['1', '2', '3'],
            loadMoreItems,
            selectedThreadId: '1',
            total: 3,
            isLoading: false,
            addNoMoreResultsItem: false,
        };
    });

    test('should match snapshot', () => {
        renderWithIntl(<VirtualizedThreadList {...props}/>);

        // AutoSizer should be rendered with mock dimensions
        expect(screen.getByTestId('auto-sizer')).toBeInTheDocument();

        // Thread rows should be rendered
        expect(screen.getByTestId('thread-row-1')).toBeInTheDocument();
        expect(screen.getByTestId('thread-row-2')).toBeInTheDocument();
        expect(screen.getByTestId('thread-row-3')).toBeInTheDocument();
    });
});
