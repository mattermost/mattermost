// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {FooterPagination} from './';

describe('components/GenericModal/FooterPagination', () => {
    const baseProps = {
        page: 0,
        total: 0,
        itemsPerPage: 0,
        onNextPage: jest.fn(),
        onPreviousPage: jest.fn(),
    };

    test('should render default', () => {
        const wrapper = shallow(
            <FooterPagination {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should render pagination legend', () => {
        const wrapper = shallow(
            <FooterPagination
                {...baseProps}
                page={0}
                total={17}
                itemsPerPage={10}
            />,
        );

        const legend = wrapper.find('.footer-pagination__legend');

        expect(legend.length).toEqual(1);
        expect(legend.at(0).text()).toEqual('Showing 1-10 of 17');
    });

    test('should render pagination buttons', () => {
        const wrapper = shallow(
            <FooterPagination
                {...baseProps}
                page={1}
                total={30}
                itemsPerPage={10}
            />,
        );

        const buttons = wrapper.find('.footer-pagination__button-container__button');

        expect(buttons.length).toEqual(2);
        expect(buttons.at(0).text()).toEqual('<ChevronLeftIcon />Previous');
        expect(buttons.at(1).text()).toEqual('Next<ChevronRightIcon />');
    });

    test('should handle pagination buttons', async () => {
        const onPreviousPage = jest.fn();
        const onNextPage = jest.fn();

        const wrapper = shallow(
            <FooterPagination
                page={1}
                total={30}
                itemsPerPage={10}
                onPreviousPage={onPreviousPage}
                onNextPage={onNextPage}
            />,
        );

        const buttons = wrapper.find('.footer-pagination__button-container__button');
        const prevButton = buttons.at(0);
        const nextButton = buttons.at(1);

        expect(prevButton.hasClass('disabled')).toBeFalsy();
        expect(nextButton.hasClass('disabled')).toBeFalsy();

        nextButton.simulate('click');

        expect(onNextPage).toHaveBeenCalledTimes(1);

        prevButton.simulate('click');

        expect(onPreviousPage).toHaveBeenCalledTimes(1);
    });
});
