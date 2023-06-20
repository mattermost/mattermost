// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {Channel, ChannelType} from '@mattermost/types/channels';

import {testComponentForLineBreak} from 'tests/helpers/line_break_helpers';

import Constants from 'utils/constants';
import EditChannelHeaderModal, {default as EditChannelHeaderModalClass} from 'components/edit_channel_header_modal/edit_channel_header_modal';
import Textbox from 'components/textbox';
import * as Utils from 'utils/utils';

const KeyCodes = Constants.KeyCodes;

describe('components/EditChannelHeaderModal', () => {
    const timestamp = Utils.getTimestamp();
    const channel = {
        id: 'fake-id',
        create_at: timestamp,
        update_at: timestamp,
        delete_at: timestamp,
        team_id: 'fake-team-id',
        type: Constants.OPEN_CHANNEL as ChannelType,
        display_name: 'Fake Channel',
        name: 'Fake Channel',
        header: 'Fake Channel',
        purpose: 'purpose',
        last_post_at: timestamp,
        creator_id: 'fake-creator-id',
        scheme_id: 'fake-scheme-id',
        group_constrained: false,
        last_root_post_at: timestamp,
    };

    const serverError = {
        server_error_id: 'fake-server-error',
        message: 'some error',
    };

    const baseProps = {
        markdownPreviewFeatureIsEnabled: false,
        channel,
        ctrlSend: false,
        show: false,
        shouldShowPreview: false,
        onExited: jest.fn(),
        actions: {
            setShowPreview: jest.fn(),
            patchChannel: jest.fn().mockResolvedValue({}),
        },
    };

    test('should match snapshot, init', () => {
        const wrapper = shallow(
            <EditChannelHeaderModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
    test('edit direct message channel', () => {
        const dmChannel: Channel = {
            ...channel,
            type: Constants.DM_CHANNEL as ChannelType,
        };

        const wrapper = shallow(
            <EditChannelHeaderModal
                {...baseProps}
                channel={dmChannel}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('submitted', () => {
        const wrapper = shallow(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        wrapper.setState({saving: true});

        expect(wrapper).toMatchSnapshot();
    });

    test('error with intl message', () => {
        const wrapper = shallow(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        wrapper.setState({serverError: {...serverError, server_error_id: 'model.channel.is_valid.header.app_error'}});
        expect(wrapper).toMatchSnapshot();
    });

    test('error without intl message', () => {
        const wrapper = shallow(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        wrapper.setState({serverError});
        expect(wrapper).toMatchSnapshot();
    });

    describe('handleSave', () => {
        test('on no change, should hide the modal without trying to patch a channel', async () => {
            const wrapper = shallow<EditChannelHeaderModal>(
                <EditChannelHeaderModal {...baseProps}/>,
            );

            await wrapper.instance().handleSave();

            expect(wrapper.state('show')).toBe(false);

            expect(baseProps.actions.patchChannel).not.toHaveBeenCalled();
        });

        test('on error, should not close modal and set server error state', async () => {
            baseProps.actions.patchChannel.mockResolvedValueOnce({error: serverError});

            const wrapper = shallow<EditChannelHeaderModal>(
                <EditChannelHeaderModal {...baseProps}/>,
            );

            wrapper.setState({header: 'New header'});

            await wrapper.instance().handleSave();

            expect(wrapper.state('show')).toBe(true);
            expect(wrapper.state('serverError')).toBe(serverError);

            expect(baseProps.actions.patchChannel).toHaveBeenCalled();
        });

        test('on success, should close modal', async () => {
            const wrapper = shallow<EditChannelHeaderModal>(
                <EditChannelHeaderModal {...baseProps}/>,
            );

            wrapper.setState({header: 'New header'});

            await wrapper.instance().handleSave();

            expect(wrapper.state('show')).toBe(false);

            expect(baseProps.actions.patchChannel).toHaveBeenCalled();
        });
    });

    test('change header', () => {
        const wrapper = shallow(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        wrapper.find(Textbox).simulate('change', {target: {value: 'header'}});

        expect(
            wrapper.state('header'),
        ).toBe('header');
    });

    test('patch on save button click', () => {
        const wrapper = shallow(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        const newHeader = 'New channel header';
        wrapper.setState({header: newHeader});
        wrapper.find('.save-button').simulate('click');

        expect(baseProps.actions.patchChannel).toBeCalledWith('fake-id', {header: newHeader});
    });

    test('patch on enter keypress event with ctrl', () => {
        const wrapper = shallow(
            <EditChannelHeaderModal
                {...baseProps}
                ctrlSend={true}
            />,
        );

        const newHeader = 'New channel header';
        wrapper.setState({header: newHeader});
        wrapper.find(Textbox).simulate('keypress', {
            preventDefault: jest.fn(),
            key: KeyCodes.ENTER[0],
            which: KeyCodes.ENTER[1],
            shiftKey: false,
            altKey: false,
            ctrlKey: true,
        });

        expect(baseProps.actions.patchChannel).toBeCalledWith('fake-id', {header: newHeader});
    });

    test('patch on enter keypress', () => {
        const wrapper = shallow(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        const newHeader = 'New channel header';
        wrapper.setState({header: newHeader});
        wrapper.find(Textbox).simulate('keypress', {
            preventDefault: jest.fn(),
            key: KeyCodes.ENTER[0],
            which: KeyCodes.ENTER[1],
            shiftKey: false,
            altKey: false,
            ctrlKey: false,
        });

        expect(baseProps.actions.patchChannel).toBeCalledWith('fake-id', {header: newHeader});
    });

    test('patch on enter keydown', () => {
        const wrapper = shallow(
            <EditChannelHeaderModal
                {...baseProps}
                ctrlSend={true}
            />,
        );

        const newHeader = 'New channel header';
        wrapper.setState({header: newHeader});
        wrapper.find(Textbox).simulate('keydown', {
            preventDefault: jest.fn(),
            key: KeyCodes.ENTER[0],
            keyCode: KeyCodes.ENTER[1],
            which: KeyCodes.ENTER[1],
            shiftKey: false,
            altKey: false,
            ctrlKey: true,
        });

        expect(baseProps.actions.patchChannel).toBeCalledWith('fake-id', {header: newHeader});
    });

    testComponentForLineBreak(
        (value: string) => (
            <EditChannelHeaderModal
                {...baseProps}
                channel={{
                    ...baseProps.channel,
                    header: value,
                }}
            />
        ),
        (instance: EditChannelHeaderModalClass) => instance.state.header,
        false,
    );
});
