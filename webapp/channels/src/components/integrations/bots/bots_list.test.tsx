// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {BrowserRouter} from 'react-router-dom';

import BotsList from './bots_list';

// Mock ListTable to avoid complex table logic and dnd issues
jest.mock('components/admin_console/list_table', () => ({
    AdminConsoleListTable: ({table}: any) => (
        <div>
            <table>
                <thead>
                    {table.getHeaderGroups().map((headerGroup: any) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header: any) => (
                                <th key={header.id}>
                                    {header.isPlaceholder ? null : header.column.columnDef.header}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map((row: any) => (
                        <tr key={row.id}>
                            {row.getVisibleCells().map((cell: any) => (
                                <td key={cell.id}>
                                    {cell.column.columnDef.cell(cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    ),
    PAGE_SIZES: [10, 20],
    LoadingStates: {
        Loading: 'loading',
        Loaded: 'loaded',
        Failed: 'failed',
    },
}));

// Mock other components
jest.mock('components/integrations/delete_integration_link', () => () => <div>{'DeleteLink'}</div>);
jest.mock('components/timestamp', () => () => <div>{'Timestamp'}</div>);
jest.mock('components/widgets/users/avatar', () => () => <div>{'Avatar'}</div>);

describe('BotsList', () => {
    const props = {
        bots: [
            {
                user_id: 'bot1',
                username: 'testbot1',
                display_name: 'Test Bot 1',
                description: 'Description 1',
                owner_id: 'user1',
                create_at: 1000,
                update_at: 1000,
                delete_at: 0,
            } as any,
            {
                user_id: 'bot2',
                username: 'testbot2',
                display_name: 'Test Bot 2',
                description: 'Description 2',
                owner_id: 'user2',
                create_at: 2000,
                update_at: 2000,
                delete_at: 3000, // disabled
            } as any,
        ],
        owners: {
            bot1: {id: 'user1', username: 'owner1'} as any,
            bot2: {id: 'user2', username: 'owner2'} as any,
        },
        users: {
            bot1: {id: 'bot1', username: 'testbot1', roles: 'system_user system_post_all'} as any,
            bot2: {id: 'bot2', username: 'testbot2', roles: 'system_user system_post_all_public'} as any,
        },
        accessTokens: {
            bot1: {
                token1: {id: 'token1', description: 'Token 1', is_active: true} as any,
            },
        },
        team: {name: 'team1'} as any,
        createBots: true,
        appsBotIDs: [],
        onDisable: jest.fn(),
        onEnable: jest.fn(),
        onCreateToken: jest.fn(),
        onEnableToken: jest.fn(),
        onDisableToken: jest.fn(),
        onRevokeToken: jest.fn(),
        loading: false,
    };

    test('renders list of bots', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <BotsList {...props}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        expect(screen.getByText('Test Bot 1 (@testbot1)', {exact: false})).toBeInTheDocument();
        expect(screen.getByText('Test Bot 2 (@testbot2)', {exact: false})).toBeInTheDocument();
    });

    test('filters bots', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <BotsList {...props}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        const searchInput = screen.getByPlaceholderText('Search Bot Accounts');
        fireEvent.change(searchInput, {target: {value: 'testbot1'}});

        expect(screen.getByText('Test Bot 1 (@testbot1)', {exact: false})).toBeInTheDocument();
        expect(screen.queryByText('Test Bot 2 (@testbot2)', {exact: false})).not.toBeInTheDocument();
    });

    test('shows enabled and disabled status', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <BotsList {...props}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        expect(screen.getAllByText('Enabled').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
    });

    test('shows token count', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <BotsList {...props}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        expect(screen.getByText('1 token')).toBeInTheDocument();
        expect(screen.getByText('No tokens')).toBeInTheDocument();
    });

    test('shows enable button for disabled bots', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <BotsList {...props}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        const enableButtons = screen.getAllByText('Enable');
        expect(enableButtons.length).toBeGreaterThan(0);
    });

    test('hides actions for apps framework bots', () => {
        const propsWithAppBot = {
            ...props,
            appsBotIDs: ['bot1'],
        };

        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <BotsList {...propsWithAppBot}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        expect(screen.getByText('Managed by Apps Framework')).toBeInTheDocument();
    });
});
