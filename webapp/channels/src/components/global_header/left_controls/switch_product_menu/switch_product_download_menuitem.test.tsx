// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isDesktopApp} from '@mattermost/shared/utils/user_agent';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ProductSwitcherDownloadMenuItem from './switch_product_download_menuitem';

jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(() => false),
}));

const mockedIsDesktopApp = jest.mocked(isDesktopApp);

describe('ProductSwitcherDownloadMenuItem', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedIsDesktopApp.mockReturnValue(false);
    });

    test('should show when an app download link is configured and not in the desktop app', () => {
        renderWithContext(<ProductSwitcherDownloadMenuItem appDownloadLink='https://mattermost.com/download'/>);

        expect(screen.getByText('Download Apps')).toBeInTheDocument();
    });

    test('should not show when there is no app download link', () => {
        renderWithContext(<ProductSwitcherDownloadMenuItem/>);

        expect(screen.queryByText('Download Apps')).not.toBeInTheDocument();
    });

    test('should not show when running in the desktop app', () => {
        mockedIsDesktopApp.mockReturnValue(true);

        renderWithContext(<ProductSwitcherDownloadMenuItem appDownloadLink='https://mattermost.com/download'/>);

        expect(screen.queryByText('Download Apps')).not.toBeInTheDocument();
    });

    test('should not show when the app download link is not a safe url', () => {
        // eslint-disable-next-line no-script-url -- the unsafe scheme is the point of the test
        const unsafeLink = 'javascript:alert(1)';

        renderWithContext(<ProductSwitcherDownloadMenuItem appDownloadLink={unsafeLink}/>);

        expect(screen.queryByText('Download Apps')).not.toBeInTheDocument();
    });
});
