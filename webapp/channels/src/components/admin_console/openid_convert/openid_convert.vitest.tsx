// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import OpenIdConvert from './openid_convert';

describe('components/OpenIdConvert', () => {
    const baseProps = {
        actions: {
            patchConfig: vi.fn(),
        },
    };

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <OpenIdConvert {...baseProps}/>,
        );

        expect(baseElement).toMatchSnapshot();
    });
});
