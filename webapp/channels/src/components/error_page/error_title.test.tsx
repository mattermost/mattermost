// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {ErrorPageTypes} from 'utils/constants';

import ErrorTitle from './error_title';

describe('components/error_page/ErrorTitle', () => {
    const baseProps = {
        type: ErrorPageTypes.LOCAL_STORAGE,
        title: '',
    };

    test('should match snapshot, local_storage type', async () => {
        const {container} = await renderWithContext(
            <ErrorTitle {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, permalink_not_found type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.PERMALINK_NOT_FOUND};
        const {container} = await renderWithContext(
            <ErrorTitle {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, oauth_missing_code type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.OAUTH_MISSING_CODE};
        const {container} = await renderWithContext(
            <ErrorTitle {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, oauth_access_denied type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.OAUTH_ACCESS_DENIED};
        const {container} = await renderWithContext(
            <ErrorTitle {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, oauth_invalid_param type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.OAUTH_INVALID_PARAM};
        const {container} = await renderWithContext(
            <ErrorTitle {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, oauth_invalid_redirect_url type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.OAUTH_INVALID_REDIRECT_URL};
        const {container} = await renderWithContext(
            <ErrorTitle {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, page_not_found type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.PAGE_NOT_FOUND};
        const {container} = await renderWithContext(
            <ErrorTitle {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, team_not_found type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.TEAM_NOT_FOUND};
        const {container} = await renderWithContext(
            <ErrorTitle {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, channel_not_found type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.CHANNEL_NOT_FOUND};
        const {container} = await renderWithContext(
            <ErrorTitle {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, no type but with title', async () => {
        const props = {...baseProps, type: '', title: 'error title'};
        const {container} = await renderWithContext(
            <ErrorTitle {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, no type nor title', async () => {
        const props = {...baseProps, type: '', title: ''};
        const {container} = await renderWithContext(
            <ErrorTitle {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
