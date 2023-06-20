// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import ListModal from './list_modal';

describe('components/ListModal', () => {
    const mockItems = [{id: '123', foo: 'bar31'}, {id: '234', foo: 'bar2'}];
    const mockItemsPage2 = [{id: '123', foo: 'bar3'}];
    const mockSearchTerm = 'ar3';
    const mockItemsSearch = mockItems.concat(mockItemsPage2).filter((item) => item.foo.includes(mockSearchTerm));
    const totalCount = mockItems.length + mockItemsPage2.length;

    const baseProps = {
        loadItems: async (pageNumber, searchTerm) => {
            if (searchTerm === mockSearchTerm) {
                return {items: mockItemsSearch, totalCount};
            }
            if (pageNumber === 0) {
                return {items: mockItems, totalCount};
            }
            return {items: mockItemsPage2, totalCount};
        },
        renderRow: (item) => {
            return (
                <div
                    className='item'
                    key={item.id}
                >
                    {item.foo}
                </div>
            );
        },
        titleText: 'foo list modal',
        searchPlaceholderText: 'search for foos',
    };

    it('should match snapshot', () => {
        const wrapper = shallow(
            <ListModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
        setTimeout(() => {
            expect(wrapper.state('items')).toEqual(mockItems);
            expect(wrapper.state('totalCount')).toEqual(totalCount);
            expect(wrapper.state('numPerPage')).toEqual(ListModal.DEFAULT_NUM_PER_PAGE);
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
        wrapper.instance().handleExit();
        expect(onHide).toHaveBeenCalledTimes(1);
    });

    test('paging loads new items', () => {
        const wrapper = shallow(
            <ListModal {...baseProps}/>,
        );
        wrapper.instance().onNext();
        setTimeout(() => {
            expect(wrapper.state('page')).toEqual(1);
            expect(wrapper.state('items')).toEqual(mockItemsPage2);
        }, 0);
        wrapper.instance().onPrev();
        setTimeout(() => {
            expect(wrapper.state('page')).toEqual(0);
            expect(wrapper.state('items')).toEqual(mockItems);
        }, 0);
    });

    test('search input', () => {
        const wrapper = shallow(
            <ListModal {...baseProps}/>,
        );
        wrapper.instance().onSearchInput({target: {value: mockSearchTerm}});
        setTimeout(() => {
            expect(wrapper.state('searchTerm')).toEqual(mockSearchTerm);
            expect(wrapper.state('items')).toEqual(mockItemsSearch);
        }, 0);
    });
});
