// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {ToggleItem} from './post_priority_picker_item';

function renderToggleItem(props: Partial<React.ComponentProps<typeof ToggleItem>> = {}) {
    const onClick = jest.fn();
    renderWithContext(
        <WithTestMenuContext>
            <ToggleItem
                ariaLabel='Request acknowledgement'
                description='An acknowledgement button will appear with your message'
                disabled={false}
                icon={<span>{'icon'}</span>}
                onClick={onClick}
                text='Request acknowledgement'
                toggled={false}
                {...props}
            />
        </WithTestMenuContext>,
    );
    return {onClick};
}

describe('ToggleItem', () => {
    it('calls onClick once when the switch is clicked', async () => {
        const {onClick} = renderToggleItem();

        await userEvent.click(screen.getByRole('switch', {name: 'Request acknowledgement'}));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick once when the menu row is clicked', async () => {
        const {onClick} = renderToggleItem();

        await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'Request acknowledgement'}));

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
