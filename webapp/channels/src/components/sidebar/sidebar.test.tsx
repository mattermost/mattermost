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
        canOpenMarketplace: true,
        isMarketplaceModalOpen: false,
        isMoreDirectBotChannelsModalOpen: false,
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

    test('should open marketplace modal correctly', () => {
        const wrapper = shallow<Sidebar>(
            <Sidebar {...baseProps}/>,
        );
        const instance = wrapper.instance();

        const mockEvent1: Partial<Event> = {
            preventDefault: jest.fn(),
            target: {
                parentElement: {
                    className: '...',
                },
            } as HTMLElement,
        };
        instance.handleOpenAppsModal(mockEvent1 as any);

        expect(baseProps.actions.openModal).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.PLUGIN_MARKETPLACE,
                dialogProps: {openedFrom: 'apps_category_menu'},
            }),
        );

        const mockEvent2: Partial<Event> = {
            preventDefault: jest.fn(),
            target: {
                parentElement: {
                    className: '..._addButton',
                },
            } as HTMLElement,
        };
        instance.handleOpenAppsModal(mockEvent2 as any);

        expect(baseProps.actions.openModal).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.PLUGIN_MARKETPLACE,
                dialogProps: {openedFrom: 'apps_category_plus'},
            }),
        );
    });

    test('should open apps modal correctly', () => {
        const wrapper = shallow<Sidebar>(
            <Sidebar
                {...baseProps}
                canOpenMarketplace={false}
            />,
        );
        const instance = wrapper.instance();
        const mockEvent: Partial<Event> = {preventDefault: jest.fn()};

        instance.handleOpenAppsModal(mockEvent as any);
        expect(baseProps.actions.openModal).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.MORE_DIRECT_BOT_CHANNELS,
            }),
        );
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
