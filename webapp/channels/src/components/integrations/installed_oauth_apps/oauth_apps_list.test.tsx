import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {IntlProvider} from 'react-intl';
import {BrowserRouter} from 'react-router-dom';

import OAuthAppsList from './oauth_apps_list';

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

describe('OAuthAppsList', () => {
    const props = {
        oauthApps: [
            {
                id: 'app1',
                name: 'App 1',
                description: 'Description 1',
                creator_id: 'u1',
                create_at: 1000,
                client_secret: 'secret1',
                callback_urls: ['https://example.com/callback'],
                is_trusted: true,
                icon_url: '',
                homepage: '',
                update_at: 1000,
            } as any,
            {
                id: 'app2',
                name: 'App 2',
                description: 'Description 2',
                creator_id: 'u2',
                create_at: 2000,
                client_secret: '',
                callback_urls: ['https://example2.com/callback'],
                is_trusted: false,
                icon_url: '',
                homepage: '',
                update_at: 2000,
                is_public: true,
            } as any,
        ],
        users: {
            u1: {id: 'u1', username: 'user1'} as any,
            u2: {id: 'u2', username: 'user2'} as any,
        },
        team: {name: 'team1'} as any,
        canManageOauth: true,
        appsOAuthAppIDs: [],
        onDelete: jest.fn(),
        onRegenSecret: jest.fn(),
        loading: false,
    };

    test('renders list of oauth apps', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <OAuthAppsList {...props}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        expect(screen.getByText('App 1')).toBeInTheDocument();
        expect(screen.getByText('App 2')).toBeInTheDocument();
        expect(screen.getByText('user1')).toBeInTheDocument();
    });

    test('filters oauth apps', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <OAuthAppsList {...props}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        const searchInput = screen.getByPlaceholderText('Search OAuth 2.0 Applications');
        fireEvent.change(searchInput, {target: {value: 'App 1'}});

        expect(screen.getByText('App 1')).toBeInTheDocument();
        expect(screen.queryByText('App 2')).not.toBeInTheDocument();
    });

    test('shows public client text for apps without secret', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <OAuthAppsList {...props}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        expect(screen.getByText('Public Client (No Secret)')).toBeInTheDocument();
    });

    test('shows trusted status', () => {
        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <OAuthAppsList {...props}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        expect(screen.getByText('Yes')).toBeInTheDocument(); // trusted
        expect(screen.getByText('No')).toBeInTheDocument(); // not trusted
    });

    test('hides actions for apps from Apps Framework', () => {
        const propsWithAppFrameworkApp = {
            ...props,
            appsOAuthAppIDs: ['app1'],
        };

        render(
            <IntlProvider locale='en'>
                <BrowserRouter>
                    <OAuthAppsList {...propsWithAppFrameworkApp}/>
                </BrowserRouter>
            </IntlProvider>,
        );

        expect(screen.getByText('Managed by Apps Framework')).toBeInTheDocument();
    });
});
