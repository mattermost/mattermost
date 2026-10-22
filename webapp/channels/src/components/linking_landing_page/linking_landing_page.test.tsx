// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import BrowserStore from 'stores/browser_store';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {navigateTo} from 'utils/browser_utils';

import LinkingLandingPage from './linking_landing_page';

jest.mock('utils/browser_utils', () => ({
    ...jest.requireActual('utils/browser_utils'),
    navigateTo: jest.fn(),
}));

const siteUrl = 'http://localhost:8065';
const landingPath = '/landing#/team-name/channels/town-square';
const redirectUrl = `${siteUrl}/team-name/channels/town-square`;
const nativeUrl = 'mattermost://localhost:8065/team-name/channels/town-square';

describe('components/LinkingLandingPage', () => {
    const baseProps = {
        desktopAppLink: 'https://mattermost.com/download/',
        siteUrl,
        siteName: 'Mattermost',
        enableCustomBrand: false,
        enableDesktopLandingPage: true,
    };

    beforeEach(() => {
        // jsdom doesn't implement navigation, so replaceState is used to put the test on a /landing URL
        // the same way that an email notification link would.
        window.history.replaceState(null, '', landingPath);
    });

    afterEach(() => {
        window.history.replaceState(null, '', '/');

        localStorage.clear();
    });

    describe('when the desktop landing page is enabled', () => {
        test('should show the landing page instead of redirecting', () => {
            renderWithContext(<LinkingLandingPage {...baseProps}/>);

            expect(screen.getByRole('heading', {name: 'Where would you like to view this?'})).toBeVisible();
            expect(screen.getByRole('link', {name: 'View in Desktop App'})).toBeVisible();
            expect(screen.getByRole('link', {name: 'View in Browser'})).toBeVisible();
            expect(navigateTo).not.toHaveBeenCalled();
        });

        test('should redirect to the browser when the browser preference is stored', () => {
            BrowserStore.setLandingPreferenceToBrowser(siteUrl);

            const {container} = renderWithContext(<LinkingLandingPage {...baseProps}/>);

            expect(container).toBeEmptyDOMElement();
            expect(navigateTo).toHaveBeenCalledWith(redirectUrl);
        });

        test('should redirect to the desktop app when the app preference is stored', () => {
            BrowserStore.setLandingPreferenceToMattermostApp(siteUrl);

            renderWithContext(<LinkingLandingPage {...baseProps}/>);

            expect(navigateTo).toHaveBeenCalledWith(nativeUrl);
            expect(screen.getByText('Opening link in Mattermost...')).toBeVisible();
        });
    });

    describe('when the desktop landing page is disabled', () => {
        const props = {...baseProps, enableDesktopLandingPage: false};

        test('should redirect to the browser without showing the landing page', () => {
            const {container} = renderWithContext(<LinkingLandingPage {...props}/>);

            expect(container).toBeEmptyDOMElement();
            expect(screen.queryByRole('heading', {name: 'Where would you like to view this?'})).not.toBeInTheDocument();
            expect(navigateTo).toHaveBeenCalledWith(redirectUrl);
        });

        test('should redirect to the browser even when the app preference is stored', () => {
            BrowserStore.setLandingPreferenceToMattermostApp(siteUrl);

            const {container} = renderWithContext(<LinkingLandingPage {...props}/>);

            expect(container).toBeEmptyDOMElement();
            expect(navigateTo).toHaveBeenCalledTimes(1);
            expect(navigateTo).toHaveBeenCalledWith(redirectUrl);
        });

        test('should not store a landing preference when redirecting', () => {
            renderWithContext(<LinkingLandingPage {...props}/>);

            expect(BrowserStore.getLandingPreference(siteUrl)).toBeNull();
        });

        test('should ignore a cross-origin redirect target', () => {
            window.history.replaceState(null, '', '/landing#https://evil.example.com/phishing');

            renderWithContext(<LinkingLandingPage {...props}/>);

            expect(navigateTo).toHaveBeenCalledWith(`${siteUrl}/`);
        });
    });
});
