// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';

import {
    renderWithContext,
    screen,
    userEvent,
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
        userEvent.click(screen.getByLabelText('menu with modal button'));

        expect(screen.getByText('Open modal')).toBeInTheDocument();

        // Click to open the modal
        userEvent.click(screen.getByText('Open modal'));

        // Wait for the menu to close before the modal will be opened
        await waitForElementToBeRemoved(() => screen.queryByText('Open modal'));

        expect(screen.getByText('A Modal')).toBeInTheDocument();
    });

    for (const enterOrSpace of ['enter', 'space']) {
        test(`should be able to open a React Bootstrap modal with the keyboard using the ${enterOrSpace} key`, async () => {
            renderWithContext(
                <MenuWithModal/>,
            );

            expect(screen.queryByText('Open modal')).not.toBeInTheDocument();
            expect(screen.queryByText('A Modal')).not.toBeInTheDocument();

            expect(document.body).toHaveFocus();

            // Tab to select the menu button
            userEvent.tab();

            expect(screen.getByLabelText('menu with modal button')).toHaveFocus();

            // Press the key to open the menu
            userEvent.keyboard('{' + enterOrSpace + '}');

            expect(screen.getByText('Open modal')).toBeInTheDocument();

            // Press the down arrow twice to select the menu item we want
            userEvent.keyboard('{arrowdown}{arrowdown}');

            expect(screen.getByText('Open modal').closest('li')).toHaveFocus();

            // Press the key to open the modal
            userEvent.keyboard('{' + enterOrSpace + '}');

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
        userEvent.click(screen.getByLabelText('menu with modal button'));

        expect(screen.getByText('Open submenu')).toBeInTheDocument();
        expect(screen.queryByText('Open model from submenu')).not.toBeInTheDocument();

        // Hover to open the submenu
        userEvent.hover(screen.getByText('Open submenu'));

        expect(screen.getByText('Open modal from submenu')).toBeInTheDocument();

        // Click to open the modal
        userEvent.click(screen.getByText('Open modal from submenu'));

        // Wait for the menu and submenu to close before the modal will be opened
        await waitForElementToBeRemoved(() => screen.queryByText('Open modal from submenu'));
        await waitForElementToBeRemoved(() => screen.queryByText('Open submenu'));

        expect(screen.getByText('A Modal')).toBeInTheDocument();
    });

    for (const enterOrSpace of ['enter', 'space']) {
        test(`should be able to open a React Bootstrap modal with the keyboard using the ${enterOrSpace} key`, async () => {
            renderWithContext(
                <MenuWithSubMenuModal/>,
            );

            expect(screen.queryByText('Open submenu')).not.toBeInTheDocument();
            expect(screen.queryByText('Open modal')).not.toBeInTheDocument();
            expect(screen.queryByText('A Modal')).not.toBeInTheDocument();

            expect(document.body).toHaveFocus();

            // Tab to select the menu button
            userEvent.tab();

            expect(screen.getByLabelText('menu with modal button')).toHaveFocus();

            // Press the key to open the menu
            userEvent.keyboard('{' + enterOrSpace + '}');

            expect(screen.getByText('Open submenu')).toBeInTheDocument();
            expect(screen.queryByText('Open model from submenu')).not.toBeInTheDocument();

            // Press the down arrow to select the submenu item
            userEvent.keyboard('{arrowdown}');

            expect(screen.getByText('Open submenu').closest('li')).toHaveFocus();

            // Press the right arrow to open the submenu
            userEvent.keyboard('{arrowright}');

            expect(screen.getByText('Open modal from submenu')).toBeInTheDocument();

            // Press the down arrow once to focus first submenu item and then twice more to select the one we want
            userEvent.keyboard('{arrowdown}{arrowdown}{arrowdown}');

            expect(screen.getByText('Open modal from submenu').closest('li')).toHaveFocus();

            // Press the key to open the modal
            userEvent.keyboard('{' + enterOrSpace + '}');

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
