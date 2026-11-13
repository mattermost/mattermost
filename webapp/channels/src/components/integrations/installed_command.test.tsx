// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import InstalledCommand from 'components/integrations/installed_command';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('components/integrations/delete_integration_link', () => {
    const ReactMock = require('react');
    return {
        __esModule: true,
        default: (props: {onDelete: () => void}) => ReactMock.createElement('button', {onClick: props.onDelete}, 'Delete'),
    };
});

describe('components/integrations/InstalledCommand', () => {
    const team = TestHelper.getTeamMock({name: 'team_name'});
    const command = TestHelper.getCommandMock({
        id: 'r5tpgt4iepf45jt768jz84djic',
        display_name: 'display_name',
        description: 'description',
        trigger: 'trigger',
        auto_complete: true,
        auto_complete_hint: 'auto_complete_hint',
        token: 'testToken',
        create_at: 1499722850203,
    });
    const creator = TestHelper.getUserMock({username: 'username'});

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'currentUserId',
            },
        },
    };

    const requiredProps = {
        team,
        command,
        onRegenToken: jest.fn(),
        onDelete: jest.fn(),
        creator,
        canChange: false,
    };

    test('should render', () => {
        const {container} = renderWithContext(
            <InstalledCommand {...requiredProps}/>,
            initialState,
        );

        const trigger = `- /${command.trigger} ${command.auto_complete_hint}`;
        expect(container.querySelector('.item-details__trigger')?.textContent).toBe(trigger);
        expect(container.querySelector('.item-details__name')?.textContent).toBe(command.display_name);
        expect(container.querySelector('.item-details__description')?.textContent).toBe(command.description);
    });

    test('should render not autocomplete, no display_name/description/auto_complete_hint', () => {
        const minCommand = TestHelper.getCommandMock({
            id: 'r5tpgt4iepf45jt768jz84djic',
            trigger: 'trigger',
            auto_complete: false,
            token: 'testToken',
            create_at: 1499722850203,
        });
        const props = {...requiredProps, command: minCommand};

        const {container} = renderWithContext(
            <InstalledCommand {...props}/>,
            initialState,
        );

        const trigger = `- /${command.trigger}`;
        expect(container.querySelector('.item-details__trigger')?.textContent).toBe(trigger);
    });

    test('should call onRegenToken function', async () => {
        const onRegenToken = jest.fn();
        const canChange = true;
        const props = {...requiredProps, onRegenToken, canChange};

        renderWithContext(
            <InstalledCommand {...props}/>,
            initialState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Regenerate Token'}));
        expect(onRegenToken).toHaveBeenCalledTimes(1);
        expect(onRegenToken).toHaveBeenCalledWith(props.command);
    });

    test('should call onDelete function', async () => {
        const onDelete = jest.fn();
        const canChange = true;
        const props = {...requiredProps, onDelete, canChange};

        renderWithContext(
            <InstalledCommand {...props}/>,
            initialState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onDelete).toHaveBeenCalledWith(props.command);
    });

    test('should filter out command', () => {
        const filter = 'no_match';
        const props = {...requiredProps, filter};

        const {container} = renderWithContext(
            <InstalledCommand {...props}/>,
            initialState,
        );
        expect(container.firstChild).toBeNull();
    });
});
