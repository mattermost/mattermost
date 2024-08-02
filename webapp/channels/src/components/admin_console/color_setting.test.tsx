// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ColorSetting from './color_setting';

describe('components/ColorSetting', () => {
    test('should match snapshot, all', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const {container} = renderWithContext(
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

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, no help text', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const {container} = renderWithContext(
            <ColorSetting
                id='id'
                label='label'
                value='#fff'
                onChange={emptyFunction}
                disabled={false}
            />,
        );
        expect(screen.queryByText('helptext')).not.toBeInTheDocument();

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, disabled', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const {container} = renderWithContext(
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

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, clicked on color setting', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const {container} = renderWithContext(
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

        expect(container).toMatchSnapshot();
    });
});
