import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { BrowserRouter } from 'react-router-dom';

import IncomingWebhooksList from './incoming_webhooks_list';

// Mock ListTable to avoid complex table logic and dnd issues
jest.mock('components/admin_console/list_table', () => ({
    AdminConsoleListTable: ({ table }: any) => (
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
jest.mock('components/timestamp', () => () => <div>Timestamp</div>);
jest.mock('components/widgets/users/avatar', () => () => <div>Avatar</div>);

describe('IncomingWebhooksList', () => {
    const props = {
        incomingWebhooks: [
            { id: '1', display_name: 'Webhook 1', channel_id: 'c1', user_id: 'u1', create_at: 1000, description: 'Desc 1' } as any,
            { id: '2', display_name: 'Webhook 2', channel_id: 'c2', user_id: 'u2', create_at: 2000, description: 'Desc 2' } as any,
        ],
        channels: {
            c1: { id: 'c1', display_name: 'Channel 1', name: 'channel-1' } as any,
            c2: { id: 'c2', display_name: 'Channel 2', name: 'channel-2' } as any,
        },
        users: {
            u1: { id: 'u1', username: 'user1' } as any,
            u2: { id: 'u2', username: 'user2' } as any,
        },
        team: { name: 'team1' } as any,
        canManageOthersWebhooks: true,
        currentUser: { id: 'u1' } as any,
        onDelete: jest.fn(),
        filter: '',
        loading: false,
    };

    test('renders list of webhooks', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <IncomingWebhooksList {...props} />
                </BrowserRouter>
            </IntlProvider>
        );

        expect(screen.getByText('Webhook 1')).toBeInTheDocument();
        expect(screen.getByText('Webhook 2')).toBeInTheDocument();
        expect(screen.getByText('Channel 1')).toBeInTheDocument();
        expect(screen.getByText('user1')).toBeInTheDocument();
    });

    test('filters webhooks', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <IncomingWebhooksList {...props} />
                </BrowserRouter>
            </IntlProvider>
        );

        const searchInput = screen.getByPlaceholderText('Search Incoming Webhooks');
        fireEvent.change(searchInput, { target: { value: 'Webhook 1' } });

        expect(screen.getByText('Webhook 1')).toBeInTheDocument();
        expect(screen.queryByText('Webhook 2')).not.toBeInTheDocument();
    });
});
