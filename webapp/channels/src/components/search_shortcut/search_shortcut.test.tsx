// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as UserAgent from '@mattermost/shared/utils/user_agent';

import {SearchShortcut} from 'components/search_shortcut';

import {render} from 'tests/react_testing_utils';

describe('components/SearchShortcut', () => {
    test('should match snapshot on Windows webapp', () => {
        jest.spyOn(UserAgent, 'isDesktopApp').mockReturnValue(false);
        jest.spyOn(UserAgent, 'isMac').mockReturnValue(false);

        const {container} = render(<SearchShortcut/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on Mac webapp', () => {
        jest.spyOn(UserAgent, 'isDesktopApp').mockReturnValue(false);
        jest.spyOn(UserAgent, 'isMac').mockReturnValue(true);

        const {container} = render(<SearchShortcut/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on Windows desktop', () => {
        jest.spyOn(UserAgent, 'isDesktopApp').mockReturnValue(true);
        jest.spyOn(UserAgent, 'isMac').mockReturnValue(false);

        const {container} = render(<SearchShortcut/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on Mac desktop', () => {
        jest.spyOn(UserAgent, 'isDesktopApp').mockReturnValue(true);
        jest.spyOn(UserAgent, 'isMac').mockReturnValue(true);

        const {container} = render(<SearchShortcut/>);
        expect(container).toMatchSnapshot();
    });
});
