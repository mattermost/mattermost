// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {Theme} from 'mattermost-redux/selectors/entities/preferences';

import NavigationRow, {NavigationRowProps} from './navigation_row';

describe('components/marketplace/navigation_row', () => {
    const baseProps: NavigationRowProps = {
        page: 0,
        total: 32,
        maximumPerPage: 15,
        onNextPageButtonClick: jest.fn(),
        onPreviousPageButtonClick: jest.fn(),
        theme: {centerChannelColor: '#fff'} as Theme,
    };

    it('should render only next button', () => {
        const wrapper = shallow<NavigationRow>(
            <NavigationRow {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('NavigationButton')).toHaveLength(1);

        wrapper.find('NavigationButton').simulate('click', {preventDefault: jest.fn});

        expect(wrapper.instance().props.onNextPageButtonClick).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().props.onPreviousPageButtonClick).toHaveBeenCalledTimes(0);
    });

    it('should render next and previous buttons', () => {
        const props = {...baseProps, page: 1};
        const wrapper = shallow<NavigationRow>(
            <NavigationRow{...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('NavigationButton')).toHaveLength(2);

        wrapper.find('NavigationButton').at(0).simulate('click', {preventDefault: jest.fn});
        wrapper.find('NavigationButton').at(1).simulate('click', {preventDefault: jest.fn});

        expect(wrapper.instance().props.onNextPageButtonClick).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().props.onPreviousPageButtonClick).toHaveBeenCalledTimes(1);
    });

    it('should render only previous button', () => {
        const props = {...baseProps, page: 2};
        const wrapper = shallow<NavigationRow>(
            <NavigationRow{...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('NavigationButton')).toHaveLength(1);

        wrapper.find('NavigationButton').simulate('click', {preventDefault: jest.fn});

        expect(wrapper.instance().props.onNextPageButtonClick).toHaveBeenCalledTimes(0);
        expect(wrapper.instance().props.onPreviousPageButtonClick).toHaveBeenCalledTimes(1);
    });

    it('should not render any buttons', () => {
        const props = {...baseProps, page: 0, total: 15};
        const wrapper = shallow<NavigationRow>(
            <NavigationRow{...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('NavigationButton')).toHaveLength(0);
    });
});
