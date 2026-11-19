// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ColorSetting from './color_setting';

describe('components/ColorSetting', () => {
    test('should render all', () => {
        function emptyFunction() {}

        renderWithContext(
            <ColorSetting
                id='id'
                label='label'
                helpText='helptext'
                value='#fff'
                onChange={emptyFunction}
                disabled={false}
            />,
        );
        expect(screen.getByText('helptext')).toBeInTheDocument();
        expect(screen.getByTestId('color-inputColorValue')).not.toBeDisabled();
    });

    test('should render no help text', () => {
        function emptyFunction() {}

        renderWithContext(
            <ColorSetting
                id='id'
                label='label'
                value='#fff'
                onChange={emptyFunction}
                disabled={false}
            />,
        );
        expect(screen.queryByText('helptext')).not.toBeInTheDocument();
    });

    test('should render disabled', () => {
        function emptyFunction() {}

        renderWithContext(
            <ColorSetting
                id='id'
                label='label'
                value='#fff'
                onChange={emptyFunction}
                disabled={true}
            />,
        );
        expect(screen.getByTestId('color-inputColorValue')).toBeDisabled();
        expect(screen.queryByText('helptext')).not.toBeInTheDocument();
    });

    test('should render clicked on color setting', () => {
        function emptyFunction() {}

        renderWithContext(
            <ColorSetting
                id='id'
                label='label'
                helpText='helptext'
                value='#fff'
                onChange={emptyFunction}
                disabled={false}
            />,
        );
        expect(screen.getByTestId('color-inputColorValue')).not.toBeDisabled();
        expect(screen.queryByText('helptext')).toBeInTheDocument();
    });
});
