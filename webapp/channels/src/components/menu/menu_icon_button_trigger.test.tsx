// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {createRef} from 'react';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {Menu} from './menu';
import {createMenuIconButtonTrigger} from './menu_icon_button_trigger';
import {MenuItem} from './menu_item';

const Trigger = createMenuIconButtonTrigger({size: 'small', padding: 'compact', style: 'inverted', className: 'base-class'});

function renderMenu(menuButtonOverrides = {}) {
    return renderWithContext(
        <Menu
            menuButton={{
                id: 'trigger',
                as: Trigger,
                'aria-label': 'More options',
                class: 'extra-class',
                children: <Icon glyph={<DotsVerticalIcon/>}/>,
                ...menuButtonOverrides,
            }}
            menuButtonTooltip={{text: 'More options'}}
            menu={{id: 'menu', 'aria-label': 'Options menu'}}
        >
            <MenuItem
                labels={<span>{'First item'}</span>}
                onClick={jest.fn()}
            />
        </Menu>,
    );
}

describe('createMenuIconButtonTrigger', () => {
    test('forwards the ref to the underlying button', () => {
        const ref = createRef<HTMLButtonElement>();

        renderWithContext(
            <Trigger
                ref={ref}
                aria-label='More options'
            >
                <Icon glyph={<DotsVerticalIcon/>}/>
            </Trigger>,
        );

        expect(ref.current).toBeInstanceOf(HTMLButtonElement);
        expect(ref.current).toBe(screen.getByRole('button', {name: 'More options'}));
    });

    test('renders a single button with merged class names and menu aria attributes', () => {
        renderMenu();

        const button = screen.getByRole('button', {name: 'More options'});

        expect(screen.getAllByRole('button')).toHaveLength(1);
        expect(button).toHaveAttribute('id', 'trigger');
        expect(button).toHaveAttribute('aria-haspopup', 'true');
        expect(button).toHaveAttribute('aria-controls', 'menu');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveClass('base-class', 'extra-class');
        expect(button.querySelector('svg')).toBeInTheDocument();
    });

    test('opens the menu on click and maps aria-expanded to the active state', async () => {
        renderMenu();

        const button = screen.getByRole('button', {name: 'More options'});
        expect(button).not.toHaveAttribute('data-active');
        expect(screen.queryByText('First item')).not.toBeInTheDocument();

        await userEvent.click(button);

        expect(screen.getByText('First item')).toBeInTheDocument();
        expect(button).toHaveAttribute('aria-expanded', 'true');
        expect(button).toHaveAttribute('data-active', 'true');
    });

    test('does not open the menu when disabled', async () => {
        renderMenu({disabled: true});

        const button = screen.getByRole('button', {name: 'More options'});
        expect(button).toBeDisabled();

        await userEvent.click(button);

        expect(screen.queryByText('First item')).not.toBeInTheDocument();
    });
});
