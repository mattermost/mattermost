// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import type {ComponentProps} from 'react';

import {Constants} from 'utils/constants';

import Row from './virtualized_thread_list_row';

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
        const wrapper = shallow(<Row {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should support item loading indicator', () => {
        const wrapper = shallow(
            <Row
                {...props}
                data={{ids: [...props.data.ids, Constants.THREADS_LOADING_INDICATOR_ITEM_ID], selectedThreadId: undefined}}
                index={3}
            />);

        expect(wrapper).toMatchSnapshot();
    });

    test('should support item search guidance ', () => {
        const wrapper = shallow(
            <Row
                {...props}
                data={{ids: [...props.data.ids, Constants.THREADS_NO_RESULTS_ITEM_ID], selectedThreadId: undefined}}
                index={3}
            />);

        expect(wrapper).toMatchSnapshot();
    });
});
