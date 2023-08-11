// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {shallow} from 'enzyme';

import VirtualizedThreadList from './virtualized_thread_list';

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
        const wrapper = shallow(<VirtualizedThreadList {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });
});
