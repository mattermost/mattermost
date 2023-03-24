// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

import TeamIcon from './team_icon';

describe('components/widgets/team-icon', () => {
    test('basic icon', () => {
        const wrapper = shallowWithIntl(
            <TeamIcon content='test'/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
    test('image icon', () => {
        const wrapper = shallowWithIntl(
            <TeamIcon
                url='http://example.com/image.png'
                content='test'
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
    test('small icon', () => {
        const wrapper = shallowWithIntl(
            <TeamIcon
                content='test'
                size='sm'
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
    test('icon with hover', () => {
        const wrapper = shallowWithIntl(
            <TeamIcon
                content='test'
                withHover={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
