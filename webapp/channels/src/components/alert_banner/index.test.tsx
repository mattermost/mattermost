// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import AlertBanner from 'components/alert_banner';

describe('Components/AlertBanner', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <AlertBanner
                mode='info'
                message='message'
                title='title'
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for app variant', () => {
        const wrapper = shallow(
            <AlertBanner
                mode='info'
                message='message'
                title='title'
                variant='app'
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when icon disabled', () => {
        const wrapper = shallow(
            <AlertBanner
                hideIcon={true}
                mode='info'
                message='message'
                title='title'
                variant='app'
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when buttons are passed', () => {
        const wrapper = shallow(
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

        expect(wrapper).toMatchSnapshot();
    });
});
