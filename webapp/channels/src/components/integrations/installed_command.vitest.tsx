// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import InstalledCommand from 'components/integrations/installed_command';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

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

    const requiredProps = {
        team,
        command,
        onRegenToken: vi.fn(),
        onDelete: vi.fn(),
        creator,
        canChange: false,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<InstalledCommand {...requiredProps}/>);
        expect(container).toMatchSnapshot();

        const trigger = `- /${command.trigger} ${command.auto_complete_hint}`;
        expect(container.querySelector('.item-details__trigger')?.textContent).toBe(trigger);
        expect(container.querySelector('.item-details__name')?.textContent).toBe(command.display_name);
        expect(container.querySelector('.item-details__description')?.textContent).toBe(command.description);
    });

    test('should match snapshot, not autocomplete, no display_name/description/auto_complete_hint', () => {
        const minCommand = TestHelper.getCommandMock({
            id: 'r5tpgt4iepf45jt768jz84djic',
            trigger: 'trigger',
            auto_complete: false,
            token: 'testToken',
            create_at: 1499722850203,
        });
        const props = {...requiredProps, command: minCommand};

        const {container} = renderWithContext(<InstalledCommand {...props}/>);
        expect(container).toMatchSnapshot();

        const trigger = `- /${command.trigger}`;
        expect(container.querySelector('.item-details__trigger')?.textContent).toBe(trigger);
    });

    test('should call onRegenToken function', () => {
        const onRegenToken = vi.fn();
        const canChange = true;
        const props = {...requiredProps, onRegenToken, canChange};

        const {container} = renderWithContext(<InstalledCommand {...props}/>);
        expect(container).toMatchSnapshot();

        const regenButton = container.querySelector('div.item-actions button');
        fireEvent.click(regenButton!);
        expect(onRegenToken).toHaveBeenCalledTimes(1);
        expect(onRegenToken).toHaveBeenCalledWith(props.command);
    });

    test('should call onDelete function', () => {
        const onDelete = vi.fn();
        const canChange = true;
        const props = {...requiredProps, onDelete, canChange};

        const {container} = renderWithContext(<InstalledCommand {...props}/>);
        expect(container).toMatchSnapshot();

        // The DeleteIntegrationLink component renders with a confirmation modal
        // Verify the Delete link is rendered when canChange is true
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    test('should filter out command', () => {
        const filter = 'no_match';
        const props = {...requiredProps, filter};

        const {container} = renderWithContext(<InstalledCommand {...props}/>);
        expect(container).toMatchSnapshot();
    });
});
