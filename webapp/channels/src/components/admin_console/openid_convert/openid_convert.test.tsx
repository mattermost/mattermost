// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import OpenIdConvert from 'components/admin_console/openid_convert/openid_convert';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/OpenIdConvert', () => {
    const baseProps = {
        actions: {
            patchConfig: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <OpenIdConvert {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
