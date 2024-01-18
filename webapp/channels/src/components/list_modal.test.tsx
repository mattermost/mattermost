// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Group} from '@mattermost/types/groups';

import {TestHelper} from 'utils/test_helper';

import ListModal, {DEFAULT_NUM_PER_PAGE} from './list_modal';

describe('components/ListModal', () => {
    const mockItem1 = TestHelper.getGroupMock({id: '123', name: 'bar31'});
    const mockItem2 = TestHelper.getGroupMock({id: '234', name: 'bar2'});
    const mockItem3 = TestHelper.getGroupMock({id: '345', name: 'bar3'});
    const mockItems = [mockItem1, mockItem2];
    const mockItemsPage2 = [mockItem3];
    const mockSearchTerm = 'ar3';
    const mockItemsSearch = mockItems.concat(mockItemsPage2).filter((item) => item.name.includes(mockSearchTerm));
    const totalCount = mockItems.length + mockItemsPage2.length;

    const baseProps = {
        loadItems: async (pageNumber: number, searchTerm: string) => {
            if (searchTerm === mockSearchTerm) {
                return {items: mockItemsSearch, totalCount};
            }
            if (pageNumber === 0) {
                return {items: mockItems, totalCount};
            }
            return {items: mockItemsPage2, totalCount};
        },
        renderRow: (item: Group) => {
            return (
                <div
                    className='item'
                    key={item.id}
                >
                    {item.id}
                </div>
            );
        },
        titleText: 'list modal',
        searchPlaceholderText: 'search for name',
        numPerPage: DEFAULT_NUM_PER_PAGE,
        titleBarButtonText: 'DEFAULT',
        titleBarButtonTextOnClick: () => {},
    };

    it('should match snapshot', () => {
        const wrapper = shallow(
            <ListModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
        setTimeout(() => {
            expect(wrapper.state('items')).toEqual(mockItems);
            expect(wrapper.state('totalCount')).toEqual(totalCount);
            expect(wrapper.state('numPerPage')).toEqual(DEFAULT_NUM_PER_PAGE);
        }, 0);
    });

    it('should update numPerPage', () => {
        const numPerPage = totalCount - 1;
        const props = {...baseProps};
        props.numPerPage = numPerPage;
        const wrapper = shallow(
            <ListModal {...props}/>,
        );
        setTimeout(() => {
            expect(wrapper.state('numPerPage')).toEqual(numPerPage);
        }, 0);
    });

    it('should match snapshot with title bar button', () => {
        const props = {...baseProps};
        props.titleBarButtonText = 'Add Foo';
        props.titleBarButtonTextOnClick = () => { };
        const wrapper = shallow(
            <ListModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should have called onHide when handleExit is called', () => {
        const onHide = jest.fn();
        const props = {...baseProps, onHide};
        const wrapper = shallow(
            <ListModal {...props}/>,
        );
        (wrapper.instance() as ListModal).handleExit();
        expect(onHide).toHaveBeenCalledTimes(1);
    });

    test('paging loads new items', () => {
        const wrapper = shallow(
            <ListModal {...baseProps}/>,
        );
        (wrapper.instance() as ListModal).onNext();
        setTimeout(() => {
            expect(wrapper.state('page')).toEqual(1);
            expect(wrapper.state('items')).toEqual(mockItemsPage2);
        }, 0);
        (wrapper.instance() as ListModal).onPrev();
        setTimeout(() => {
            expect(wrapper.state('page')).toEqual(0);
            expect(wrapper.state('items')).toEqual(mockItems);
        }, 0);
    });

    test('search input', () => {
        const wrapper = shallow(
            <ListModal {...baseProps}/>,
        );
        (wrapper.instance() as ListModal).onSearchInput({target: {value: mockSearchTerm}} as React.ChangeEvent<HTMLInputElement>);
        setTimeout(() => {
            expect(wrapper.state('searchTerm')).toEqual(mockSearchTerm);
            expect(wrapper.state('items')).toEqual(mockItemsSearch);
        }, 0);
    });
});
