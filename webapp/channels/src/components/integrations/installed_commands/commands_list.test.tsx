import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {IntlProvider} from 'react-intl';
import {BrowserRouter} from 'react-router-dom';

import CommandsList from './commands_list';

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
jest.mock('components/copy_text', () => () => <div>CopyText</div>);
jest.mock('components/integrations/delete_integration_link', () => () => <div>DeleteLink</div>);
jest.mock('components/integrations/regenerate_token_link', () => () => <div>RegenerateLink</div>);
jest.mock('components/timestamp', () => () => <div>Timestamp</div>);
jest.mock('components/widgets/users/avatar', () => () => <div>Avatar</div>);

describe('CommandsList', () => {
    const props = {
        commands: [
            {
                id: '1',
                display_name: 'Command 1',
                description: 'Description 1',
                trigger: 'cmd1',
                creator_id: 'u1',
                create_at: 1000,
                token: 'token1',
                auto_complete: true,
                auto_complete_hint: '[hint]',
            } as any,
            {
                id: '2',
                display_name: 'Command 2',
                description: 'Description 2',
                trigger: 'cmd2',
                creator_id: 'u2',
                create_at: 2000,
                token: 'token2',
                auto_complete: false,
            } as any,
        ],
        users: {
            u1: {id: 'u1', username: 'user1'} as any,
            u2: {id: 'u2', username: 'user2'} as any,
        },
        team: {name: 'team1'} as any,
        canManageOthersSlashCommands: true,
        currentUser: {id: 'u1'} as any,
        onDelete: jest.fn(),
        onRegenToken: jest.fn(),
        loading: false,
    };

    test('renders list of commands', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <CommandsList {...props}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        expect(screen.getByText('Command 1')).toBeInTheDocument();
        expect(screen.getByText('Command 2')).toBeInTheDocument();
        expect(screen.getByText('user1')).toBeInTheDocument();
    });

    test('filters commands', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <CommandsList {...props}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        const searchInput = screen.getByPlaceholderText('Search slash commands...');
        fireEvent.change(searchInput, {target: {value: 'Command 1'}});

        expect(screen.getByText('Command 1')).toBeInTheDocument();
        expect(screen.queryByText('Command 2')).not.toBeInTheDocument();
    });

    test('shows trigger with hint', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <CommandsList {...props}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        expect(screen.getByText('/cmd1 [hint]')).toBeInTheDocument();
        expect(screen.getByText('/cmd2')).toBeInTheDocument();
    });
});
