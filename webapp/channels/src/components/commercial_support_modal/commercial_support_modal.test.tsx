// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import CommercialSupportModal from 'components/commercial_support_modal/commercial_support_modal';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('react-bootstrap', () => {
    const Modal = ({children, show}: {children: React.ReactNode; show: boolean}) => (show ? <div>{children}</div> : null);
    Modal.Header = ({children}: {children: React.ReactNode}) => <div>{children}</div>;
    Modal.Body = ({children}: {children: React.ReactNode}) => <div>{children}</div>;
    Modal.Title = ({children}: {children: React.ReactNode}) => <div>{children}</div>;
    return {Modal};
});

jest.mock('components/alert_banner', () => (props: {message: React.ReactNode}) => (
    <div>{props.message}</div>
));

jest.mock('components/external_link', () => ({children, href}: {children: React.ReactNode; href: string}) => (
    <a href={href}>{children}</a>
));

jest.mock('components/widgets/loading/loading_spinner', () => () => <div>{'Loading...'}</div>);

describe('components/CommercialSupportModal', () => {
    beforeAll(() => {
        // Mock getSystemRoute to return a valid URL
        jest.spyOn(Client4, 'getSystemRoute').mockImplementation(() => 'http://localhost:8065/api/v4/system');

        // Mock createObjectURL
        window.URL.createObjectURL = jest.fn().mockReturnValue('mock-url');
    });

    afterAll(() => {
        jest.restoreAllMocks();

        // @ts-expect-error - TS doesn't like deleting built-in methods
        delete window.URL.createObjectURL;
    });

    const baseProps = {
        onExited: jest.fn(),
        showBannerWarning: false,
        isCloud: false,
        currentUser: TestHelper.getUserMock(),
        packetContents: [
            {id: 'basic.contents', label: 'Basic contents', selected: true, mandatory: true},
            {id: 'basic.server.logs', label: 'Server logs', selected: true, mandatory: false},
        ],
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<CommercialSupportModal {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should render packet content checkboxes with mandatory disabled', () => {
        renderWithContext(<CommercialSupportModal {...baseProps}/>);

        const basicContents = screen.getByRole('checkbox', {name: 'Basic contents'});
        const serverLogs = screen.getByRole('checkbox', {name: 'Server logs'});

        expect(basicContents).toBeChecked();
        expect(basicContents).toBeDisabled();
        expect(serverLogs).toBeChecked();
        expect(serverLogs).toBeEnabled();
    });

    test('should toggle optional packet content checkbox', async () => {
        renderWithContext(<CommercialSupportModal {...baseProps}/>);

        const user = userEvent.setup();
        const serverLogs = screen.getByRole('checkbox', {name: 'Server logs'});

        expect(serverLogs).toBeChecked();
        await user.click(serverLogs);
        expect(serverLogs).not.toBeChecked();
        await user.click(serverLogs);
        expect(serverLogs).toBeChecked();
    });

    test('should translate built-in option labels and pass plugin labels through', () => {
        const props = {
            ...baseProps,
            packetContents: [
                {id: 'basic.contents', label: 'untranslated basic', selected: true, mandatory: true},
                {id: 'basic.server.logs', label: 'untranslated logs', selected: true, mandatory: false},
                {id: 'com.mattermost.calls', label: 'Calls plugin', selected: false, mandatory: false},
            ],
        };
        renderWithContext(
            <CommercialSupportModal {...props}/>,
            {},
            {
                intlMessages: {
                    'commercial_support_modal.basic_contents.label': 'Grundinhalte',
                    'commercial_support_modal.server_logs.label': 'Serverprotokolle',
                },
            },
        );

        expect(screen.getByRole('checkbox', {name: 'Grundinhalte'})).toBeInTheDocument();
        expect(screen.getByRole('checkbox', {name: 'Serverprotokolle'})).toBeInTheDocument();
        expect(screen.getByRole('checkbox', {name: 'Calls plugin'})).toBeInTheDocument();
        expect(screen.queryByText('untranslated basic')).not.toBeInTheDocument();
        expect(screen.queryByText('untranslated logs')).not.toBeInTheDocument();
    });

    test('should describe built-in options and leave plugin options without a description', () => {
        const props = {
            ...baseProps,
            packetContents: [
                ...baseProps.packetContents,
                {id: 'com.mattermost.calls', label: 'Calls plugin', selected: false, mandatory: false},
            ],
        };
        renderWithContext(<CommercialSupportModal {...props}/>);

        expect(screen.getByRole('checkbox', {name: 'Basic contents'})).toHaveAccessibleDescription(
            '(required) Server version, sanitized configuration, usage counts, job status, permissions, plugin list, and performance profiles. Does not include message content.',
        );
        expect(screen.getByRole('checkbox', {name: 'Server logs'})).toHaveAccessibleDescription(
            'Recent server log files. May contain user IDs, IP addresses, and error details.',
        );
        expect(screen.getByRole('checkbox', {name: 'Calls plugin'})).not.toHaveAttribute('aria-describedby');

        expect(screen.getAllByText('(required)')).toHaveLength(1);
        expect(screen.getByText('Basic contents').closest('.CommercialSupportModal__option')).toContainElement(screen.getByText('(required)'));
    });

    test('should expand and collapse the list of what Basic contents includes', async () => {
        renderWithContext(<CommercialSupportModal {...baseProps}/>);

        const user = userEvent.setup();
        const toggle = screen.getByRole('button', {name: 'What\'s included'});

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('list')).not.toBeInTheDocument();

        await user.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const list = screen.getByRole('list');
        expect(toggle).toHaveAttribute('aria-controls', list.id);
        expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
            'Server version, license, and server ID',
            'System diagnostics: OS, CPU, memory, database, file storage, and connectivity checks',
            'Configuration with credentials removed',
            'Usage counts: users, posts, channels, teams',
            'Background job status',
            'Permission schemes and roles',
            'Installed plugins and their versions',
            'Database table structure (no data)',
            'Performance profiles (CPU, memory, goroutines)',
        ]);

        await user.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    test('should show error message when download fails', async () => {
        const errorMessage = 'Failed to download';
        const detailedError = 'Permission denied';

        // Mock the fetch call to return an error
        global.fetch = jest.fn().mockImplementation(() =>
            Promise.resolve({
                ok: false,
                json: () => Promise.resolve({
                    message: errorMessage,
                    detailed_error: detailedError,
                }),
            }),
        );

        renderWithContext(<CommercialSupportModal {...baseProps}/>);

        const user = userEvent.setup();
        const downloadLink = screen.getByRole('button', {name: 'Download Support Packet'});
        if (!downloadLink) {
            throw new Error('Download Support Packet link not found');
        }
        await user.click(downloadLink);

        // Verify error message is shown
        expect(await screen.findByText(`${errorMessage}: ${detailedError}`)).toBeInTheDocument();
    });

    test('should clear error when starting new download', async () => {
        // Mock the fetch call to succeed
        global.fetch = jest.fn().mockImplementation(() =>
            Promise.resolve({
                ok: true,
                blob: () => Promise.resolve(new Blob()),
                headers: {get: () => null},
            }),
        );

        const ref = React.createRef<CommercialSupportModal>();
        renderWithContext(
            <CommercialSupportModal
                {...baseProps}
                ref={ref}
            />,
        );

        act(() => {
            ref.current?.setState({error: 'Previous error'});
        });
        expect(screen.getByText('Previous error')).toBeInTheDocument();

        // Start download
        const user = userEvent.setup();
        const downloadLink = screen.getByText('Download Support Packet').closest('button');
        if (!downloadLink) {
            throw new Error('Download Support Packet link not found');
        }
        await user.click(downloadLink);

        // Verify error is cleared
        await waitFor(() => {
            expect(screen.queryByText('Previous error')).not.toBeInTheDocument();
        });
    });
});
