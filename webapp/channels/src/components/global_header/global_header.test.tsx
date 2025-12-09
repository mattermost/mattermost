// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import * as redux from 'react-redux';

import GlobalHeader from 'components/global_header/global_header';
import {useCurrentProductId} from 'utils/products';

jest.mock('utils/products', () => ({
    useCurrentProductId: jest.fn(),
}));

describe('components/global/global_header', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    test('should be disabled when global header is disabled', () => {
        const spy = jest.spyOn(redux, 'useSelector');
        spy.mockReturnValue(false);
        (useCurrentProductId as jest.Mock).mockReturnValue(null);

        const wrapper = shallow(
            <GlobalHeader/>,
        );

        // Global header should render null
        expect(wrapper.type()).toEqual(null);
    });

    test('should be enabled when global header is enabled', () => {
        const spy = jest.spyOn(redux, 'useSelector');
        spy.mockReturnValue(true);
        (useCurrentProductId as jest.Mock).mockReturnValue(null);

        const wrapper = shallow(
            <GlobalHeader/>,
        );

        // Global header should not be null
        expect(wrapper.type()).not.toEqual(null);
    });
});
