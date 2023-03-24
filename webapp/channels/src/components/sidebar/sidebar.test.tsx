// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import Sidebar from 'components/sidebar/sidebar';
import Constants, {ModalIdentifiers} from '../../utils/constants';

describe('components/sidebar', () => {
    const baseProps = {
        canCreatePublicChannel: true,
        canCreatePrivateChannel: true,
        canJoinPublicChannel: true,
        isOpen: false,
        teamId: 'fake_team_id',
        hasSeenModal: true,
        isCloud: false,
        unreadFilterEnabled: false,
        isMobileView: false,
        isKeyBoardShortcutModalOpen: false,
        userGroupsEnabled: false,
        canCreateCustomGroups: true,
        showWorkTemplateButton: true,
        actions: {
            createCategory: jest.fn(),
            fetchMyCategories: jest.fn(),
            openModal: jest.fn(),
            closeModal: jest.fn(),
            clearChannelSelection: jest.fn(),
            closeRightHandSide: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <Sidebar {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when direct channels modal is open', () => {
        const wrapper = shallow(
            <Sidebar {...baseProps}/>,
        );

        wrapper.instance().setState({showDirectChannelsModal: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when more channels modal is open', () => {
        const wrapper = shallow(
            <Sidebar {...baseProps}/>,
        );

        wrapper.instance().setState({showMoreChannelsModal: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('Should call Shortcut modal on FORWARD_SLASH+ctrl/meta', () => {
        const wrapper = shallow<Sidebar>(
            <Sidebar {...baseProps}/>,
        );
        const instance = wrapper.instance();

        let key = Constants.KeyCodes.BACK_SLASH[0] as string;
        let keyCode = Constants.KeyCodes.BACK_SLASH[1] as number;
        instance.handleKeyDownEvent({ctrlKey: true, preventDefault: jest.fn(), key, keyCode} as any);
        expect(wrapper.instance().props.actions.openModal).not.toHaveBeenCalled();

        key = 'ù';
        keyCode = Constants.KeyCodes.FORWARD_SLASH[1] as number;
        instance.handleKeyDownEvent({ctrlKey: true, preventDefault: jest.fn(), key, keyCode} as any);
        expect(wrapper.instance().props.actions.openModal).toHaveBeenCalledWith(expect.objectContaining({modalId: ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL}));

        key = '/';
        keyCode = Constants.KeyCodes.SEVEN[1] as number;
        instance.handleKeyDownEvent({ctrlKey: true, preventDefault: jest.fn(), key, keyCode} as any);
        expect(wrapper.instance().props.actions.openModal).toHaveBeenCalledWith(expect.objectContaining({modalId: ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL}));

        key = Constants.KeyCodes.FORWARD_SLASH[0] as string;
        keyCode = Constants.KeyCodes.FORWARD_SLASH[1] as number;
        instance.handleKeyDownEvent({ctrlKey: true, preventDefault: jest.fn(), key, keyCode} as any);
        expect(wrapper.instance().props.actions.openModal).toHaveBeenCalledWith(expect.objectContaining({modalId: ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL}));
    });

    test('should toggle direct messages modal correctly', () => {
        const wrapper = shallow<Sidebar>(
            <Sidebar {...baseProps}/>,
        );
        const instance = wrapper.instance();
        const mockEvent: Partial<Event> = {preventDefault: jest.fn()};

        instance.hideMoreDirectChannelsModal = jest.fn();
        instance.showMoreDirectChannelsModal = jest.fn();

        instance.handleOpenMoreDirectChannelsModal(mockEvent as any);
        expect(instance.showMoreDirectChannelsModal).toHaveBeenCalled();

        instance.setState({showDirectChannelsModal: true});
        instance.handleOpenMoreDirectChannelsModal(mockEvent as any);
        expect(instance.hideMoreDirectChannelsModal).toHaveBeenCalled();
    });

    test('should match empty div snapshot when teamId is missing', () => {
        const props = {
            ...baseProps,
            teamId: '',
        };
        const wrapper = shallow(
            <Sidebar {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
