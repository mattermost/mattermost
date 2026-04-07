// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {ErrorPageTypes} from 'utils/constants';

import ErrorMessage from './error_message';

describe('components/error_page/ErrorMessage', () => {
    const baseProps = {
        type: ErrorPageTypes.LOCAL_STORAGE,
        message: '',
        service: '',
    };

    const state = {
        entities: {
            users: {
                currentUserId: 'user-id-123',
            },
            general: {
                config: {
                    TelemetryId: 'telemetry-id-456',
                    Version: '9.0.0',
                },
            },
        },
    };

    test('should match snapshot, local_storage type', async () => {
        const {container} = await renderWithContext(
            <ErrorMessage {...baseProps}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, permalink_not_found type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.PERMALINK_NOT_FOUND};
        const {container} = await renderWithContext(
            <ErrorMessage {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, oauth_missing_code type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.OAUTH_MISSING_CODE, service: 'Gitlab'};
        const {container} = await renderWithContext(
            <ErrorMessage {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, oauth_access_denied type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.OAUTH_ACCESS_DENIED, service: 'Gitlab'};
        const {container} = await renderWithContext(
            <ErrorMessage {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, oauth_invalid_param type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.OAUTH_INVALID_PARAM, message: 'error message'};
        const {container} = await renderWithContext(
            <ErrorMessage {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, oauth_invalid_redirect_url type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.OAUTH_INVALID_REDIRECT_URL, message: 'error message'};
        const {container} = await renderWithContext(
            <ErrorMessage {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, page_not_found type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.PAGE_NOT_FOUND};
        const {container} = await renderWithContext(
            <ErrorMessage {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, team_not_found type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.TEAM_NOT_FOUND};
        const {container} = await renderWithContext(
            <ErrorMessage {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, channel_not_found type', async () => {
        const props = {...baseProps, type: ErrorPageTypes.CHANNEL_NOT_FOUND};
        const {container} = await renderWithContext(
            <ErrorMessage {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, channel_not_found type for guest', async () => {
        const props = {...baseProps, type: ErrorPageTypes.CHANNEL_NOT_FOUND, isGuest: true};
        const {container} = await renderWithContext(
            <ErrorMessage {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, no type but with message', async () => {
        const props = {...baseProps, type: '', message: 'error message'};
        const {container} = await renderWithContext(
            <ErrorMessage {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, no type nor message', async () => {
        const props = {...baseProps, type: '', message: ''};
        const {container} = await renderWithContext(
            <ErrorMessage {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });
});
