// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import AlertBanner from '.';

describe('Components/AlertBanner', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <AlertBanner
                mode='info'
                message='message'
                title='title'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for app variant', () => {
        const {container} = renderWithContext(
            <AlertBanner
                mode='info'
                message='message'
                title='title'
                variant='app'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when icon disabled', () => {
        const {container} = renderWithContext(
            <AlertBanner
                hideIcon={true}
                mode='info'
                message='message'
                title='title'
                variant='app'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when buttons are passed', () => {
        const {container} = renderWithContext(
            <AlertBanner
                hideIcon={true}
                mode='info'
                message='message'
                title='title'
                variant='app'
                actionButtonLeft={<div id='actionButtonLeft'/>}
                actionButtonRight={<div id='actionButtonRight'/>}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
