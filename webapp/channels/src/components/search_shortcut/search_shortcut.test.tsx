// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as UserAgent from '@mattermost/shared/utils/user_agent';

import {SearchShortcut} from 'components/search_shortcut';

import {render} from 'tests/react_testing_utils';

const isDesktopAppMock = jest.mocked(UserAgent.isDesktopApp);
const isMacMock = jest.mocked(UserAgent.isMac);
jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(),
    isMac: jest.fn(),
}));

describe('components/SearchShortcut', () => {
    test('should match snapshot on Windows webapp', () => {
        isDesktopAppMock.mockReturnValue(false);
        isMacMock.mockReturnValue(false);

        const {container} = render(<SearchShortcut/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on Mac webapp', () => {
        isDesktopAppMock.mockReturnValue(false);
        isMacMock.mockReturnValue(true);

        const {container} = render(<SearchShortcut/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on Windows desktop', () => {
        isDesktopAppMock.mockReturnValue(true);
        isMacMock.mockReturnValue(false);

        const {container} = render(<SearchShortcut/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on Mac desktop', () => {
        isDesktopAppMock.mockReturnValue(true);
        isMacMock.mockReturnValue(true);

        const {container} = render(<SearchShortcut/>);
        expect(container).toMatchSnapshot();
    });
});
