// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {SearchShortcut} from 'components/search_shortcut';

describe('components/SearchShortcut', () => {
    test('should match snapshot on Windows webapp', () => {
        jest.mock('utils/user_agent', () => {
            const original = jest.requireActual('utils/user_agent');
            return {
                ...original,
                isDesktopApp: jest.fn(() => false),
                isMac: jest.fn(() => false),
            };
        });

        const wrapper = shallow(<SearchShortcut/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on Mac webapp', () => {
        jest.mock('utils/user_agent', () => {
            const original = jest.requireActual('utils/user_agent');
            return {
                ...original,
                isDesktopApp: jest.fn(() => false),
                isMac: jest.fn(() => true),
            };
        });

        const wrapper = shallow(<SearchShortcut/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on Windows desktop', () => {
        jest.mock('utils/user_agent', () => {
            const original = jest.requireActual('utils/user_agent');
            return {
                ...original,
                isDesktopApp: jest.fn(() => true),
                isMac: jest.fn(() => true),
            };
        });

        const wrapper = shallow(<SearchShortcut/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on Mac desktop', () => {
        jest.mock('utils/user_agent', () => {
            const original = jest.requireActual('utils/user_agent');
            return {
                ...original,
                isDesktopApp: jest.fn(() => true),
                isMac: jest.fn(() => true),
            };
        });

        const wrapper = shallow(<SearchShortcut/>);
        expect(wrapper).toMatchSnapshot();
    });
});
