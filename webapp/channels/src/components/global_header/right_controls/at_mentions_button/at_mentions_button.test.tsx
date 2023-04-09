// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import IconButton from '@mattermost/compass-components/components/icon-button'; // eslint-disable-line no-restricted-imports

import {GlobalState} from 'types/store';

import AtMentionsButton from './at_mentions_button';

const mockDispatch = jest.fn();
let mockState: GlobalState;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/global/AtMentionsButton', () => {
    beforeEach(() => {
        mockState = {views: {rhs: {isSidebarOpen: true}}} as GlobalState;
    });

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AtMentionsButton/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should show active mentions', () => {
        const wrapper = shallow(
            <AtMentionsButton/>,
        );

        wrapper.find(IconButton).simulate('click', {
            preventDefault: jest.fn(),
        });
        expect(mockDispatch).toHaveBeenCalledTimes(1);
    });
});
