// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import OpenIdConvert from 'components/admin_console/openid_convert/openid_convert';

describe('components/OpenIdConvert', () => {
    const baseProps = {
        actions: {
            updateConfig: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <OpenIdConvert {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
