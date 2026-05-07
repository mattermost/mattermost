// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import ErrorLink from './error_link';

describe('components/error_page/ErrorLink', () => {
    const baseProps = {
        url: 'https://docs.mattermost.com/deployment/sso-gitlab.html',
        message: {
            id: 'error.oauth_missing_code.gitlab.link',
            defaultMessage: 'GitLab',
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ErrorLink {...baseProps}/>,
            {
                entities: {
                    users: {
                        currentUserId: 'uid-123',
                    },
                    general: {
                        config: {
                            TelemetryId: 'sid-456',
                            Version: '11.4.0',
                        },
                    },
                },
            },
        );

        expect(container).toMatchSnapshot();
    });
});
