// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ColorSetting from 'components/admin_console/color_setting';
import {renderWithIntl} from 'tests/react_testing_utils';

describe('components/ColorSetting', () => {
    test('should match snapshot, all', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = renderWithIntl(
            <ColorSetting
                id='id'
                label='label'
                helpText='helptext'
                value='#fff'
                onChange={emptyFunction}
                disabled={false}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, no help text', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = renderWithIntl(
            <ColorSetting
                id='id'
                label='label'
                value='#fff'
                onChange={emptyFunction}
                disabled={false}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, disabled', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = renderWithIntl(
            <ColorSetting
                id='id'
                label='label'
                value='#fff'
                onChange={emptyFunction}
                disabled={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, clicked on color setting', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = renderWithIntl(
            <ColorSetting
                id='id'
                label='label'
                helpText='helptext'
                value='#fff'
                onChange={emptyFunction}
                disabled={false}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
