// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import FlagIcon from 'components/widgets/icons/flag_icon';
import MentionsIcon from 'components/widgets/icons/mentions_icon';
import PinIcon from 'components/widgets/icons/pin_icon';
import SearchIcon from 'components/widgets/icons/search_icon';

import HeaderIconWrapper from 'components/channel_header/components/header_icon_wrapper';

describe('components/channel_header/components/HeaderIconWrapper', () => {
    function emptyFunction() {} //eslint-disable-line no-empty-function
    const mentionsIcon = (
        <MentionsIcon
            className='icon icon__mentions'
            aria-hidden='true'
        />
    );

    const baseProps = {
        iconComponent: mentionsIcon,
        buttonClass: 'button_class',
        buttonId: 'button_id',
        onClick: emptyFunction,
        tooltipKey: 'recentMentions',
    };

    test('should match snapshot, on MentionsIcon', () => {
        const wrapper = shallow(
            <HeaderIconWrapper {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on FlagIcon', () => {
        const flagIcon = (
            <FlagIcon
                className='icon icon__flag'
                aria-hidden='true'
            />
        );

        const props = {...baseProps, iconComponent: flagIcon, tooltipKey: 'flaggedPosts'};
        const wrapper = shallow(
            <HeaderIconWrapper {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on PinIcon', () => {
        const pinIcon = (
            <PinIcon
                className='icon icon__pin'
                aria-hidden='true'
            />
        );

        const props = {...baseProps, iconComponent: pinIcon, tooltipKey: 'pinnedPosts', buttonClass: 'pinned_posts_class'};
        const wrapper = shallow(
            <HeaderIconWrapper {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on ChannelFilesIcon', () => {
        const channelFilesIcon = <i className='icon icon-file-document-outline'/>;

        const props = {...baseProps, iconComponent: channelFilesIcon, tooltipKey: 'channelFiles', buttonClass: 'channel_files_class'};
        const wrapper = shallow(
            <HeaderIconWrapper {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on SearchIcon', () => {
        const searchIcon = (
            <SearchIcon
                className='icon icon__search'
                aria-hidden='true'
            />
        );

        const props = {...baseProps, iconComponent: searchIcon, tooltipKey: 'search', buttonClass: 'search_class'};
        const wrapper = shallow(
            <HeaderIconWrapper {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on PluginIcon with tooltipText', () => {
        const pluginIcon = (
            <i className='fa fa-anchor'/>
        );

        const props = {...baseProps, iconComponent: pluginIcon, tooltipKey: 'plugin', tooltipText: 'plugin_tooltip_text'};
        const wrapper = shallow(
            <HeaderIconWrapper {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on PluginIcon without tooltipText', () => {
        const pluginIcon = (
            <i className='fa fa-anchor'/>
        );

        const props = {...baseProps, iconComponent: pluginIcon, tooltipKey: 'plugin'};
        const wrapper = shallow(
            <HeaderIconWrapper {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
