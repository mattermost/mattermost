// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {mount} from 'enzyme';

import * as CustomStatusSelectors from 'selectors/views/custom_status';

import mockStore from 'tests/test_store';

import CustomStatusText from './custom_status_text';

jest.mock('selectors/views/custom_status');

describe('components/custom_status/custom_status_text', () => {
    const store = mockStore({});

    it('should match snapshot', () => {
        const wrapper = mount(<CustomStatusText/>, {wrappingComponent: Provider, wrappingComponentProps: {store}});

        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot with props', () => {
        const wrapper = mount(
            <CustomStatusText
                tooltipDirection='top'
                text='In a meeting'
            />,
            {wrappingComponent: Provider, wrappingComponentProps: {store}},
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should not render when EnableCustomStatus in config is false', () => {
        (CustomStatusSelectors.isCustomStatusEnabled as any as jest.Mock).mockReturnValue(false);
        const wrapper = mount(<CustomStatusText/>, {wrappingComponent: Provider, wrappingComponentProps: {store}});

        expect(wrapper.isEmptyRender()).toBeTruthy();
    });
});
