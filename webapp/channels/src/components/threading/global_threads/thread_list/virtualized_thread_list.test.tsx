// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import VirtualizedThreadList from './virtualized_thread_list';

jest.mock('react-virtualized-auto-sizer', () => {
    return function MockAutoSizer({children}: {children: (size: {height: number; width: number}) => React.ReactNode}) {
        return <div>{children({height: 500, width: 300})}</div>;
    };
});

jest.mock('./virtualized_thread_list_row', () => {
    return function MockRow({index, style, data}: any) {
        return (
            <div
                style={style}
                data-testid={`thread-row-${data.ids[index]}`}
            >
                {data.ids[index]}
            </div>
        );
    };
});

describe('components/threading/global_threads/thread_list/virtualized_thread_list', () => {
    let props: ComponentProps<typeof VirtualizedThreadList>;
    let loadMoreItems: (startIndex: number, stopIndex: number) => Promise<any>;

    beforeEach(() => {
        loadMoreItems = () => Promise.resolve();

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
        const {baseElement} = renderWithContext(<VirtualizedThreadList {...props}/>);
        expect(baseElement).toMatchSnapshot();
    });
});
