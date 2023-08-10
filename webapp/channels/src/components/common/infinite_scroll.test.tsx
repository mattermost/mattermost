// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import InfiniteScroll from 'components/common/infinite_scroll';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import type {ReactWrapper} from 'enzyme';

describe('/components/common/InfiniteScroll', () => {
    const baseProps = {
        callBack: jest.fn(),
        endOfData: false,
        endOfDataMessage: 'No more items to fetch',
        styleClass: 'signup-team-all',
        totalItems: 20,
        itemsPerPage: 10,
        pageNumber: 1,
    };

    let wrapper: ReactWrapper<any, any, InfiniteScroll>;

    beforeEach(() => {
        wrapper = mountWithIntl(<InfiniteScroll {...baseProps}><div/></InfiniteScroll>) as unknown as ReactWrapper<any, any, InfiniteScroll>;
    });

    test('should match snapshot', () => {
        expect(wrapper).toMatchSnapshot();

        const wrapperDiv = wrapper.find(`.${baseProps.styleClass}`);

        // InfiniteScroll is styled by the user's style
        expect(wrapperDiv.exists()).toBe(true);

        // Ensure that scroll is added to InfiniteScroll wrapper div
        expect(wrapperDiv.hasClass('infinite-scroll')).toBe(true);
    });

    test('should attach and remove event listeners', () => {
        const instance = wrapper.instance();
        const node = instance.node;
        node.current!.addEventListener = jest.fn();
        node.current!.removeEventListener = jest.fn();

        instance.componentDidMount();
        expect(node.current!.addEventListener).toHaveBeenCalledTimes(1);
        expect(node.current!.removeEventListener).not.toBeCalled();

        instance.componentWillUnmount();

        expect(node.current!.removeEventListener).toHaveBeenCalledTimes(1);
    });

    test('should execute call back function when scroll reaches the bottom and there \'s more data and no current fetch is taking place', () => {
        const instance = wrapper.instance();

        expect(baseProps.callBack).toHaveBeenCalledTimes(0);

        instance.handleScroll();
        expect(wrapper.state().isFetching).toBe(true);
        expect(baseProps.callBack).toHaveBeenCalledTimes(1);
    });

    test('should not execute call back even if scroll is a the bottom when there \'s no more data', () => {
        wrapper.setState({isEndofData: true});
        const instance = wrapper.instance();

        instance.handleScroll();
        expect(baseProps.callBack).toHaveBeenCalledTimes(0);
    });

    test('should not show loading screen if there is no data', () => {
        let loadingDiv = wrapper.find('.loading-screen');
        expect(loadingDiv.exists()).toBe(false);
        wrapper.setState({isFetching: true});
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.state().isFetching).toBe(true);

        // Now it should show the loader.
        loadingDiv = wrapper.find('.loading-screen');
        expect(loadingDiv.exists()).toBe(true);
    });
});
