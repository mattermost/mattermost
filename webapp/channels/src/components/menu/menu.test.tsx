// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';

import {
    renderWithContext,
    screen,
    userEvent,
    waitFor,
    waitForElementToBeRemoved,
} from 'tests/react_testing_utils';

import {Menu} from './menu';
import {MenuItem} from './menu_item';
import {SubMenu} from './sub_menu';

describe('menu click handlers', () => {
    test('should be able to open a React Bootstrap modal with the mouse', async () => {
        renderWithContext(
            <MenuWithModal/>,
        );

        expect(screen.queryByText('Open modal')).not.toBeInTheDocument();
        expect(screen.queryByText('A Modal')).not.toBeInTheDocument();

        // Click to open the menu
        await userEvent.click(screen.getByLabelText('menu with modal button'));

        expect(screen.getByText('Open modal')).toBeInTheDocument();

        // Click to open the modal
        await userEvent.click(screen.getByText('Open modal'));

        // Wait for the menu to close before the modal will be opened
        await waitForElementToBeRemoved(() => screen.queryByText('Open modal'));

        expect(screen.getByText('A Modal')).toBeInTheDocument();
    });

    for (const enterOrSpace of ['enter', 'space']) {
        const key = enterOrSpace === 'space' ? ' ' : '{enter}';

        test(`should be able to open a React Bootstrap modal with the keyboard using the ${enterOrSpace} key`, async () => {
            renderWithContext(
                <MenuWithModal/>,
            );

            expect(screen.queryByText('Open modal')).not.toBeInTheDocument();
            expect(screen.queryByText('A Modal')).not.toBeInTheDocument();

            expect(document.body).toHaveFocus();

            // Tab to select the menu button
            await userEvent.tab();

            expect(screen.getByLabelText('menu with modal button')).toHaveFocus();

            // Press the key to open the menu
            await userEvent.keyboard(key);

            expect(screen.getByText('Open modal')).toBeInTheDocument();

            // Press the down arrow twice to select the menu item we want
            await userEvent.keyboard('{arrowdown}{arrowdown}');

            expect(screen.getByText('Open modal').closest('li')).toHaveFocus();

            // Press the key to open the modal
            await userEvent.keyboard(key);

            // Wait for the menu to close before the modal will be opened
            await waitForElementToBeRemoved(() => screen.queryByText('Open modal'));

            expect(screen.getByText('A Modal')).toBeInTheDocument();
        });
    }

    test('should be able to open a React Bootstrap modal from a submenu with the mouse', async () => {
        renderWithContext(
            <MenuWithSubMenuModal/>,
        );

        expect(screen.queryByText('Open submenu')).not.toBeInTheDocument();
        expect(screen.queryByText('Open modal')).not.toBeInTheDocument();
        expect(screen.queryByText('A Modal')).not.toBeInTheDocument();

        // Click to open the menu
        await userEvent.click(screen.getByLabelText('menu with modal button'));

        expect(screen.getByText('Open submenu')).toBeInTheDocument();
        expect(screen.queryByText('Open model from submenu')).not.toBeInTheDocument();

        // Hover to open the submenu
        await userEvent.hover(screen.getByText('Open submenu'));

        expect(screen.getByText('Open modal from submenu')).toBeInTheDocument();

        // Click to open the modal
        await userEvent.click(screen.getByText('Open modal from submenu'));

        // Wait for the menu and submenu to close before the modal will be opened
        await waitFor(() => {
            expect(screen.queryByText('Open modal from submenu')).not.toBeInTheDocument();
            expect(screen.queryByText('Open submenu')).not.toBeInTheDocument();
        });

        expect(screen.getByText('A Modal')).toBeInTheDocument();
    });

    for (const enterOrSpace of ['enter', 'space']) {
        const key = enterOrSpace === 'space' ? ' ' : '{enter}';

        test(`should be able to open a React Bootstrap modal with the keyboard using the ${enterOrSpace} key`, async () => {
            renderWithContext(
                <MenuWithSubMenuModal/>,
            );

            expect(screen.queryByText('Open submenu')).not.toBeInTheDocument();
            expect(screen.queryByText('Open modal')).not.toBeInTheDocument();
            expect(screen.queryByText('A Modal')).not.toBeInTheDocument();

            expect(document.body).toHaveFocus();

            // Tab to select the menu button
            await userEvent.tab();

            expect(screen.getByLabelText('menu with modal button')).toHaveFocus();

            // Press the key to open the menu
            await userEvent.keyboard(key);

            expect(screen.getByText('Open submenu')).toBeInTheDocument();
            expect(screen.queryByText('Open model from submenu')).not.toBeInTheDocument();

            // Press the down arrow to select the submenu item
            await userEvent.keyboard('{arrowdown}');

            expect(screen.getByText('Open submenu').closest('li')).toHaveFocus();

            // Press the right arrow to open the submenu
            await userEvent.keyboard('{arrowright}');

            expect(screen.getByText('Open modal from submenu')).toBeInTheDocument();

            // Press the down arrow once to focus first submenu item and then twice more to select the one we want
            await userEvent.keyboard('{arrowdown}{arrowdown}');

            expect(screen.getByText('Open modal from submenu').closest('li')).toHaveFocus();

            // Press the key to open the modal
            await userEvent.keyboard(key);

            // Wait for the menu and submenu to close before the modal will be opened
            await waitForElementToBeRemoved(() => screen.queryByText('Open submenu'));

            expect(screen.getByText('A Modal')).toBeInTheDocument();
        });
    }
});

function MenuWithModal() {
    const [showModal, setShowModal] = useState(false);

    let modal;
    if (showModal) {
        modal = (
            <GenericModal
                show={showModal}
                confirmButtonText='Confirm button'
                modalHeaderText='A Modal'
                onExited={() => setShowModal(false)}
            >
                {'The contents of A Modal'}
            </GenericModal>
        );
    }

    return (
        <>
            <Menu
                menu={{
                    id: 'Menu',
                }}
                menuButton={{
                    id: 'Menu-Button',
                    'aria-label': 'menu with modal button',
                    children: <DotsVerticalIcon size={16}/>,
                }}
            >
                <OtherMenuItem/>
                <OtherMenuItem/>
                <MenuItem
                    labels={<span>{'Open modal'}</span>}
                    onClick={() => setShowModal(true)}
                />
            </Menu>
            {modal}
        </>
    );
}

function MenuWithSubMenuModal() {
    const [showModal, setShowModal] = useState(false);

    let modal;
    if (showModal) {
        modal = (
            <GenericModal
                show={showModal}
                confirmButtonText='Confirm button'
                modalHeaderText='A Modal'
                onExited={() => setShowModal(false)}
            >
                {'The contents of A Modal'}
            </GenericModal>
        );
    }

    return (
        <>
            <Menu
                menu={{
                    id: 'Menu',
                }}
                menuButton={{
                    id: 'Menu-Button',
                    'aria-label': 'menu with modal button',
                    children: <DotsVerticalIcon size={16}/>,
                }}
            >
                <OtherMenuItem/>
                <SubMenu
                    id='Menu-SubMenu'
                    labels={<>{'Open submenu'}</>}
                    menuId='Menu-SubMenu-Menu'
                >
                    <OtherMenuItem/>
                    <OtherMenuItem/>
                    <MenuItem
                        labels={<span>{'Open modal from submenu'}</span>}
                        onClick={() => setShowModal(true)}
                    />
                    <OtherMenuItem/>
                </SubMenu>
            </Menu>
            {modal}
        </>
    );
}

function OtherMenuItem(props: any) {
    return (
        <MenuItem
            {...props}
            labels={<>{'Some menu item'}</>}
            onClick={() => {
                throw new Error("don't click me");
            }}
        />
    );
}

/**
 * isMenuOpen control transition matrix.
 *
 * Reference: react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
 *
 * The Menu mirrors the controlled `isMenuOpen` prop into internal state on
 * transition. After the transition, internal state is the source of truth;
 * releasing control (true → undefined) leaves the menu open until the user
 * dismisses, and a controlled-false closes regardless of internal state.
 */
describe('Menu — isMenuOpen control transition matrix', () => {
    function ControllableMenu({forceOpen, onToggle}: {forceOpen?: boolean; onToggle?: (open: boolean) => void}) {
        return (
            <Menu
                menu={{
                    id: 'Menu',
                    isMenuOpen: forceOpen,
                    onToggle,
                }}
                menuButton={{
                    id: 'Menu-Button',
                    'aria-label': 'controlled menu button',
                    children: <DotsVerticalIcon size={16}/>,
                }}
            >
                <MenuItem
                    labels={<span>{'Item 1'}</span>}
                    onClick={() => { /* noop */ }}
                />
            </Menu>
        );
    }

    function getMenu() {
        return screen.queryByText('Item 1');
    }

    describe('uncontrolled (no isMenuOpen prop)', () => {
        test('starts closed; user click opens', async () => {
            renderWithContext(<ControllableMenu/>);

            expect(getMenu()).not.toBeInTheDocument();

            await userEvent.click(screen.getByLabelText('controlled menu button'));

            expect(getMenu()).toBeInTheDocument();
        });

        test('Escape closes the open menu', async () => {
            renderWithContext(<ControllableMenu/>);

            await userEvent.click(screen.getByLabelText('controlled menu button'));
            expect(getMenu()).toBeInTheDocument();

            await userEvent.keyboard('{Escape}');

            await waitForElementToBeRemoved(getMenu);
        });
    });

    describe('controlled mount', () => {
        test('mounting with isMenuOpen={true} opens immediately', () => {
            renderWithContext(<ControllableMenu forceOpen={true}/>);

            expect(getMenu()).toBeInTheDocument();
        });

        test('mounting with isMenuOpen={false} stays closed', () => {
            renderWithContext(<ControllableMenu forceOpen={false}/>);

            expect(getMenu()).not.toBeInTheDocument();
        });
    });

    describe('controlled prop transitions', () => {
        test('undefined → true: opens', () => {
            const {rerender} = renderWithContext(<ControllableMenu/>);
            expect(getMenu()).not.toBeInTheDocument();

            rerender(<ControllableMenu forceOpen={true}/>);

            expect(getMenu()).toBeInTheDocument();
        });

        test('true → false: closes', async () => {
            const {rerender} = renderWithContext(<ControllableMenu forceOpen={true}/>);
            expect(getMenu()).toBeInTheDocument();

            rerender(<ControllableMenu forceOpen={false}/>);

            await waitForElementToBeRemoved(getMenu);
        });

        test('false → true: opens', () => {
            const {rerender} = renderWithContext(<ControllableMenu forceOpen={false}/>);
            expect(getMenu()).not.toBeInTheDocument();

            rerender(<ControllableMenu forceOpen={true}/>);

            expect(getMenu()).toBeInTheDocument();
        });

        test('true → undefined: stays open (releases control)', () => {
            const {rerender} = renderWithContext(<ControllableMenu forceOpen={true}/>);
            expect(getMenu()).toBeInTheDocument();

            rerender(<ControllableMenu/>);

            expect(getMenu()).toBeInTheDocument();
        });

        test('false → undefined: stays closed', () => {
            const {rerender} = renderWithContext(<ControllableMenu forceOpen={false}/>);
            expect(getMenu()).not.toBeInTheDocument();

            rerender(<ControllableMenu/>);

            expect(getMenu()).not.toBeInTheDocument();
        });
    });

    describe('hybrid (controlled prop + user actions)', () => {
        test('uncontrolled-open → controlled-true → controlled-false closes', async () => {
            // The bookmark keyboard-reorder integration relies on this exact
            // sequence: user opens menu (uncontrolled), reorder fallback
            // promotes to controlled-true, then onOverflowOpenChange(false)
            // sets controlled-false, menu must close.
            const {rerender} = renderWithContext(<ControllableMenu/>);
            await userEvent.click(screen.getByLabelText('controlled menu button'));
            expect(getMenu()).toBeInTheDocument();

            // Reorder starts → fallback promotes to controlled-true
            rerender(<ControllableMenu forceOpen={true}/>);
            expect(getMenu()).toBeInTheDocument();

            // Cross overflow→bar → controlled-false issued
            rerender(<ControllableMenu forceOpen={false}/>);

            await waitForElementToBeRemoved(getMenu);
        });

        test('after release, user can dismiss the open menu', async () => {
            const {rerender} = renderWithContext(<ControllableMenu forceOpen={true}/>);
            expect(getMenu()).toBeInTheDocument();

            // Caller releases control; menu stays open in uncontrolled mode
            rerender(<ControllableMenu/>);
            expect(getMenu()).toBeInTheDocument();

            // User dismisses
            await userEvent.keyboard('{Escape}');

            await waitForElementToBeRemoved(getMenu);
        });

        test('after release, user can re-open via the button', async () => {
            const {rerender} = renderWithContext(<ControllableMenu forceOpen={false}/>);
            expect(getMenu()).not.toBeInTheDocument();

            // Caller releases the close command
            rerender(<ControllableMenu/>);
            expect(getMenu()).not.toBeInTheDocument();

            await userEvent.click(screen.getByLabelText('controlled menu button'));

            expect(getMenu()).toBeInTheDocument();
        });
    });

    describe('onToggle callback', () => {
        test('fires (true) when the menu opens via prop', () => {
            const onToggle = jest.fn();
            renderWithContext(
                <ControllableMenu
                    forceOpen={true}
                    onToggle={onToggle}
                />,
            );

            expect(onToggle).toHaveBeenCalledWith(true);
        });

        test('fires (false) when controlled prop closes the menu', async () => {
            const onToggle = jest.fn();
            const {rerender} = renderWithContext(
                <ControllableMenu
                    forceOpen={true}
                    onToggle={onToggle}
                />,
            );
            onToggle.mockClear();

            rerender(
                <ControllableMenu
                    forceOpen={false}
                    onToggle={onToggle}
                />,
            );

            await waitFor(() => expect(onToggle).toHaveBeenCalledWith(false));
        });

        test('fires (false) when user dismisses the menu', async () => {
            const onToggle = jest.fn();
            renderWithContext(
                <ControllableMenu
                    forceOpen={true}
                    onToggle={onToggle}
                />,
            );
            onToggle.mockClear();

            await userEvent.keyboard('{Escape}');

            await waitFor(() => expect(onToggle).toHaveBeenCalledWith(false));
        });
    });
});
