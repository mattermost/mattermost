// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Channel, ChannelType} from '@mattermost/types/channels';

import {EditChannelHeaderModal} from 'components/edit_channel_header_modal/edit_channel_header_modal';
import type {EditChannelHeaderModal as EditChannelHeaderModalClass} from 'components/edit_channel_header_modal/edit_channel_header_modal';
import Textbox from 'components/textbox';

import {type MockIntl} from 'tests/helpers/intl-test-helper';
import {testComponentForLineBreak} from 'tests/helpers/line_break_helpers';
import Constants from 'utils/constants';
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
        intl: {
            formatMessage: ({defaultMessage}) => defaultMessage,
        } as MockIntl,
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
            const wrapper = shallow(
                <EditChannelHeaderModal {...baseProps}/>,
            );

            const instance = wrapper.instance() as EditChannelHeaderModalClass;

            await instance.handleSave();

            expect(wrapper.state('show')).toBe(false);

            expect(baseProps.actions.patchChannel).not.toHaveBeenCalled();
        });

        test('on error, should not close modal and set server error state', async () => {
            baseProps.actions.patchChannel.mockResolvedValueOnce({error: serverError});

            const wrapper = shallow(
                <EditChannelHeaderModal {...baseProps}/>,
            );

            const instance = wrapper.instance() as EditChannelHeaderModalClass;

            wrapper.setState({header: 'New header'});

            await instance.handleSave();

            expect(wrapper.state('show')).toBe(true);
            expect(wrapper.state('serverError')).toBe(serverError);

            expect(baseProps.actions.patchChannel).toHaveBeenCalled();
        });

        test('on success, should close modal', async () => {
            const wrapper = shallow(
                <EditChannelHeaderModal {...baseProps}/>,
            );

            const instance = wrapper.instance() as EditChannelHeaderModalClass;

            wrapper.setState({header: 'New header'});

            await instance.handleSave();

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

    test('should show error only for invalid length', () => {
        const wrapper = shallow(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        wrapper.find(Textbox).simulate('change', {target: {value: `The standard Lorem Ipsum passage, used since the 1500s
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
        
        Section 1.10.32 of "de Finibus Bonorum et Malorum", written by Cicero in 45 BC
        "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?"
        
        1914 translation by H. Rackham
        "But I must explain to you how all this mistaken idea of denouncing pleasure and praising pain was born and I will give you a complete account of the system, and expound the actual teachings of the great explorer of the truth, the master-builder of human happiness. No one rejects, dislikes, or avoids pleasure itself, because it is pleasure, but because those who do not know how to pursue pleasure rationally encounter consequences that are extremely painful. Nor again is there anyone who loves or pursues or desires to obtain pain of itself, because it is pain, but because occasionally circumstances occur in which toil and pain can procure him some great pleasure. To take a trivial example, which of us ever undertakes laborious physical exercise, except to obtain some advantage from it? But who has any right to find fault with a man who chooses to enjoy a pleasure that has no annoying consequences, or one who avoids a pain that produces no resultant pleasure?"
        
        Section 1.10.33 of "de Finibus Bonorum et Malorum", written by Cicero in 45 BC
        "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat."`}});

        expect(
            wrapper.state('serverError'),
        ).toStrictEqual({message: 'Invalid header length', server_error_id: 'model.channel.is_valid.header.app_error'});

        wrapper.find(Textbox).simulate('change', {target: {value: 'valid header'}});

        expect(
            wrapper.state('serverError'),
        ).toBeNull();
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
        (instance: React.Component<any, any>) => instance.state.header,
        false,
    );
});
