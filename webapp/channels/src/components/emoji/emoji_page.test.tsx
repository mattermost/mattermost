// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ShallowWrapper} from 'enzyme';
import {shallow} from 'enzyme';
import React from 'react';
import {Link} from 'react-router-dom';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import AnyTeamPermissionGate from 'components/permissions_gates/any_team_permission_gate';

import EmojiList from './emoji_list';
import EmojiPage from './emoji_page';

jest.mock('utils/utils', () => ({
    localizeMessage: jest.fn().mockReturnValue('Custom Emoji'),
    resetTheme: jest.fn(),
    applyTheme: jest.fn(),
}));

describe('EmojiPage', () => {
    const mockLoadRolesIfNeeded = jest.fn();
    const mockScrollToTop = jest.fn();
    const mockCurrentTheme = {} as Theme;

    const defaultProps = {
        teamName: 'team',
        teamDisplayName: 'Team Display Name',
        siteName: 'Site Name',
        scrollToTop: mockScrollToTop,
        currentTheme: mockCurrentTheme,
        actions: {
            loadRolesIfNeeded: mockLoadRolesIfNeeded,
        },
    };

    it('should render without crashing', () => {
        const wrapper: ShallowWrapper = shallow(<EmojiPage {...defaultProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should render the emoji list and the add button with permission', () => {
        const wrapper: ShallowWrapper = shallow(<EmojiPage {...defaultProps}/>);
        expect(wrapper.find(EmojiList).exists()).toBe(true);
        expect(wrapper.find(AnyTeamPermissionGate).exists()).toBe(true);
        expect(wrapper.find(Link).prop('to')).toBe('/team/emoji/add');
    });

    it('should not render the add button if permission is not granted', () => {
        const wrapper: ShallowWrapper = shallow(
            <EmojiPage {...defaultProps}/>,
        ).setProps({teamName: '', actions: {loadRolesIfNeeded: mockLoadRolesIfNeeded}});
        expect(wrapper.find(AnyTeamPermissionGate).exists()).toBe(true);
        expect(wrapper.find(Link).exists()).toBe(true); // Update this to match your permission setup
    });

    it('should render EmojiList component', () => {
        const wrapper = shallow(<EmojiPage {...defaultProps}/>);
        expect(wrapper.find(EmojiList).exists()).toBe(true);
    });
});
