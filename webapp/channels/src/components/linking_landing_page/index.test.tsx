// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {navigateTo} from 'utils/browser_utils';

import LinkingLandingPage from './index';

jest.mock('utils/browser_utils', () => ({
    ...jest.requireActual('utils/browser_utils'),
    navigateTo: jest.fn(),
}));

const siteUrl = 'http://localhost:8065';
const landingPath = '/landing#/team-name/channels/town-square';
const redirectUrl = `${siteUrl}/team-name/channels/town-square`;

describe('components/LinkingLandingPage (connected)', () => {
    function makeState(enableDesktopLandingPage: 'true' | 'false') {
        return {
            entities: {
                general: {
                    config: {
                        SiteURL: siteUrl,
                        SiteName: 'Mattermost',
                        AppDownloadLink: 'https://mattermost.com/download/',
                        EnableDesktopLandingPage: enableDesktopLandingPage,
                    },
                },
            },
        };
    }

    beforeEach(() => {
        // jsdom doesn't implement navigation, so replaceState is used to put the test on a /landing URL
        // the same way that an email notification link would.
        window.history.replaceState(null, '', landingPath);
    });

    afterEach(() => {
        window.history.replaceState(null, '', '/');

        localStorage.clear();
    });

    test('should show the landing page when EnableDesktopLandingPage is true', () => {
        renderWithContext(<LinkingLandingPage/>, makeState('true'));

        expect(screen.getByRole('heading', {name: 'Where would you like to view this?'})).toBeVisible();
        expect(navigateTo).not.toHaveBeenCalled();
    });

    test('should redirect to the browser when EnableDesktopLandingPage is false', () => {
        const {container} = renderWithContext(<LinkingLandingPage/>, makeState('false'));

        expect(container).toBeEmptyDOMElement();
        expect(navigateTo).toHaveBeenCalledWith(redirectUrl);
    });
});
