// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import CopyUrlContextMenu from 'components/copy_url_context_menu/copy_url_context_menu';

describe('components/CopyUrlContextMenu', () => {
    test('should copy relative url on click', () => {
        const props = {
            siteURL: 'http://example.com',
            link: '/path/to/resource',
            menuId: 'resource',
            actions: {
                copyToClipboard: jest.fn(),
            },
        };

        const wrapper = shallow(
            <CopyUrlContextMenu {...props}>
                <span>{'Click'}</span>
            </CopyUrlContextMenu>,
        );

        expect(wrapper).toMatchSnapshot();
        wrapper.find('MenuItem').simulate('click');
        expect(props.actions.copyToClipboard).toBeCalledWith('http://example.com/path/to/resource');
    });

    test('should copy absolute url on click', () => {
        const props = {
            siteURL: 'http://example.com',
            link: 'http://site.example.com/path/to/resource',
            menuId: 'resource',
            actions: {
                copyToClipboard: jest.fn(),
            },
        };

        const wrapper = shallow(
            <CopyUrlContextMenu {...props}>
                <span>{'Click'}</span>
            </CopyUrlContextMenu>,
        );

        expect(wrapper).toMatchSnapshot();
        wrapper.find('MenuItem').simulate('click');
        expect(props.actions.copyToClipboard).toBeCalledWith('http://site.example.com/path/to/resource');
    });
});
