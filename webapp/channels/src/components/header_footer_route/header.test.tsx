// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import Header from './header';

describe('components/header_footer_route/header', () => {
    const renderHeader = (siteName: string, license: Record<string, string>) => renderWithContext(
        <Header/>,
        {entities: {general: {config: {SiteName: siteName}, license}}},
    );

    test('free edition, default name: the edition banner is a home link', () => {
        renderHeader('Mattermost', {IsLicensed: 'false'});

        expect(screen.getByTestId('public.header.banner--link')).toHaveTextContent('TEAM EDITION');
        expect(screen.queryByTestId('public.header.title--link')).not.toBeInTheDocument();
    });

    test('free edition, custom name: the banner, then the site name', () => {
        renderHeader('Acme Chat', {IsLicensed: 'false'});

        expect(screen.getByTestId('public.header.banner--link')).toHaveTextContent('TEAM EDITION');
        expect(screen.getByTestId('public.header.title--link')).toHaveTextContent('Acme Chat');
    });

    test('entry edition, default name: the entry banner is a home link', () => {
        renderHeader('Mattermost', {IsLicensed: 'true', SkuShortName: LicenseSkus.Entry});

        expect(screen.getByTestId('public.header.banner--link')).toHaveTextContent('ENTRY EDITION');
    });

    test('licensed, default name: the logo alone as the title', () => {
        renderHeader('Mattermost', {IsLicensed: 'true', SkuShortName: LicenseSkus.Enterprise});

        expect(screen.getByTestId('public.header.title--link').querySelector('svg')).toBeInTheDocument();
        expect(screen.queryByTestId('public.header.banner--link')).not.toBeInTheDocument();
    });

    test('licensed, custom name: the site name alone', () => {
        renderHeader('Acme Chat', {IsLicensed: 'true', SkuShortName: LicenseSkus.Enterprise});

        expect(screen.queryByTestId('public.header.banner--link')).not.toBeInTheDocument();
        expect(screen.getByTestId('public.header.title--link')).toHaveTextContent('Acme Chat');
    });
});
