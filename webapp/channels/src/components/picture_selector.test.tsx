// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import PictureSelector from 'components/picture_selector';

describe('components/picture_selector', () => {
    const baseProps = {
        name: 'picture_selector_test',
        onSelect: jest.fn(),
        onRemove: jest.fn(),
    };

    test('should match snapshot, no picture selected', () => {
        const wrapper = shallow(
            <PictureSelector {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, existing picture provided', () => {
        const props = {
            ...baseProps,
            src: 'http:///url.com/picture.jpg',
            defaultSrc: 'http:///url.com/default-picture.jpg',
        };

        const wrapper = shallow(
            <PictureSelector {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, default picture provided', () => {
        const props = {
            ...baseProps,
            defaultSrc: 'http:///url.com/default-picture.jpg',
        };

        const wrapper = shallow(
            <PictureSelector {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
