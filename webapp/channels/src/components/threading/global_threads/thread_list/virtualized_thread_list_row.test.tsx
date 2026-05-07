// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {Constants} from 'utils/constants';

import Row from './virtualized_thread_list_row';

jest.mock('../thread_item', () => {
    return function MockThreadItem(props: any) {
        return (
            <div
                data-testid={`thread-item-${props.threadId}`}
                data-selected={props.isSelected}
                style={props.style}
            />
        );
    };
});

jest.mock('components/search_shortcut/search_shortcut', () => ({
    SearchShortcut: () => <span>{'Ctrl+F'}</span>,
}));

describe('components/threading/global_threads/thread_list/virtualized_thread_list_row', () => {
    let props: ComponentProps<typeof Row>;

    beforeEach(() => {
        props = {
            data: {
                ids: ['1', '2', '3'],
                selectedThreadId: undefined,
            },
            index: 1,
            style: {},
        };
    });

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(<Row {...props}/>);
        expect(baseElement).toMatchSnapshot();
    });

    test('should support item loading indicator', () => {
        const {baseElement} = renderWithContext(
            <Row
                {...props}
                data={{ids: [...props.data.ids, Constants.THREADS_LOADING_INDICATOR_ITEM_ID], selectedThreadId: undefined}}
                index={3}
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should support item search guidance ', () => {
        const {baseElement} = renderWithContext(
            <Row
                {...props}
                data={{ids: [...props.data.ids, Constants.THREADS_NO_RESULTS_ITEM_ID], selectedThreadId: undefined}}
                index={3}
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });
});
