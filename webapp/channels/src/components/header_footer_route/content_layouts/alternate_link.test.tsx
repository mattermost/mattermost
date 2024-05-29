// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow, mount} from 'enzyme';
import React from 'react';
import {BrowserRouter} from 'react-router-dom';

import AlternateLink from './alternate_link';

describe('components/header_footer_route/content_layouts/alternate_link', () => {
    it('should return default', () => {
        const wrapper = shallow(
            <AlternateLink/>,
        );

        expect(wrapper).toEqual({});
    });

    it('should show with message', () => {
        const alternateMessage = 'alternateMessage';

        const wrapper = shallow(
            <AlternateLink alternateMessage={alternateMessage}/>,
        );

        expect(wrapper.find('.alternate-link__message').text()).toEqual(alternateMessage);
    });

    it('should show with link', () => {
        const alternateLinkPath = 'alternateLinkPath';
        const alternateLinkLabel = 'alternateLinkLabel';

        const wrapper = mount(
            <BrowserRouter>
                <AlternateLink
                    alternateLinkPath={alternateLinkPath}
                    alternateLinkLabel={alternateLinkLabel}
                />
            </BrowserRouter>,
        );

        const link = wrapper.find('.alternate-link__link').first();

        expect(link.text()).toEqual(alternateLinkLabel);
        expect(link.props().to).toEqual({pathname: alternateLinkPath, search: ''});
    });
});
