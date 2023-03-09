// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {Team} from '@mattermost/types/teams';
import {Command} from '@mattermost/types/integrations';

import {TestHelper} from 'utils/test_helper';
import EditCommand from 'components/integrations/edit_command/edit_command';

describe('components/integrations/EditCommand', () => {
    const getCustomTeamCommands = jest.fn(
        () => {
            return new Promise<Command[]>((resolve) => {
                process.nextTick(() => resolve([]));
            });
        },
    );

    const commands = {
        r5tpgt4iepf45jt768jz84djic: TestHelper.getCommandMock({
            id: 'r5tpgt4iepf45jt768jz84djic',
            display_name: 'display_name',
            description: 'description',
            trigger: 'trigger',
            auto_complete: true,
            auto_complete_hint: 'auto_complete_hint',
            auto_complete_desc: 'auto_complete_desc',
            token: 'jb6oyqh95irpbx8fo9zmndkp1r',
            create_at: 1499722850203,
            creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
            delete_at: 0,
            icon_url: 'https://google.com/icon',
            method: 'G',
            team_id: 'm5gix3oye3du8ghk4ko6h9cq7y',
            update_at: 1504468859001,
            url: 'https://google.com/command',
            username: 'username',
        }),
    };
    const team: Team = TestHelper.getTeamMock({
        name: 'test',
        id: 'm5gix3oye3du8ghk4ko6h9cq7y',
    });

    const editCommandRequest = {
        status: 'not_started',
        error: null,
    };

    const baseProps = {
        team,
        commandId: 'r5tpgt4iepf45jt768jz84djic',
        commands,
        editCommandRequest,
        actions: {
            getCustomTeamCommands,
            editCommand: jest.fn(),
        },
        enableCommands: true,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <EditCommand {...baseProps}/>,
        );

        wrapper.setState({originalCommand: commands.r5tpgt4iepf45jt768jz84djic});
        expect(wrapper).toMatchSnapshot();

        expect(baseProps.actions.getCustomTeamCommands).toHaveBeenCalled();
        expect(baseProps.actions.getCustomTeamCommands).toHaveBeenCalledWith(team.id);
    });

    test('should match snapshot, loading', () => {
        const wrapper = shallow(
            <EditCommand {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when EnableCommands is false', () => {
        const actions = {
            getCustomTeamCommands: jest.fn(),
            editCommand: jest.fn(),
        };
        const props = {...baseProps, actions, enableCommands: false};
        const wrapper = shallow(
            <EditCommand {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(actions.getCustomTeamCommands).not.toHaveBeenCalled();
    });

    test('should have match state when handleConfirmModal is called', () => {
        const props = {...baseProps, getCustomTeamCommands};
        const wrapper = shallow<EditCommand>(
            <EditCommand {...props}/>,
        );

        wrapper.setState({showConfirmModal: false});
        wrapper.instance().handleConfirmModal();
        expect(wrapper.state('showConfirmModal')).toEqual(true);
    });

    test('should have match state when confirmModalDismissed is called', () => {
        const props = {...baseProps, getCustomTeamCommands};
        const wrapper = shallow<EditCommand>(
            <EditCommand {...props}/>,
        );

        wrapper.setState({showConfirmModal: true});
        wrapper.instance().confirmModalDismissed();
        expect(wrapper.state('showConfirmModal')).toEqual(false);
    });

    test('should have match renderExtra', () => {
        const props = {...baseProps, getCustomTeamCommands};
        const wrapper = shallow<EditCommand>(
            <EditCommand {...props}/>,
        );

        expect(wrapper.instance().renderExtra()).toMatchSnapshot();
    });

    test('should have match when editCommand is called', () => {
        const props = {...baseProps, getCustomTeamCommands};
        const wrapper = shallow<EditCommand>(
            <EditCommand {...props}/>,
        );

        wrapper.setState({originalCommand: commands.r5tpgt4iepf45jt768jz84djic});
        const instance = wrapper.instance();
        instance.handleConfirmModal = jest.fn();
        instance.submitCommand = jest.fn();
        wrapper.instance().editCommand(commands.r5tpgt4iepf45jt768jz84djic);

        expect(instance.handleConfirmModal).not.toBeCalled();
        expect(instance.submitCommand).toBeCalled();
    });
});
