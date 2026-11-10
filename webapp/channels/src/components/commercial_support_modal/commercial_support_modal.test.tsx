// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ClientError} from '@mattermost/client';

import {Client4} from 'mattermost-redux/client';

import ConnectedCommercialSupportModal from 'components/commercial_support_modal';
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

jest.mock('components/alert_banner', () => (props: {message: React.ReactNode; onDismiss: () => void}) => (
    <div>
        {props.message}
        <button onClick={props.onDismiss}>{'Dismiss'}</button>
    </div>
));

jest.mock('components/external_link', () => ({children, href}: {children: React.ReactNode; href: string}) => (
    <a href={href}>{children}</a>
));

jest.mock('components/widgets/loading/loading_spinner', () => () => <div>{'Loading...'}</div>);

describe('components/CommercialSupportModal', () => {
    beforeAll(() => {
        // Mock createObjectURL and revokeObjectURL
        window.URL.createObjectURL = jest.fn().mockReturnValue('mock-url');
        window.URL.revokeObjectURL = jest.fn();
    });

    afterAll(() => {
        jest.restoreAllMocks();

        // @ts-expect-error - TS doesn't like deleting built-in methods
        delete window.URL.createObjectURL;

        // @ts-expect-error - TS doesn't like deleting built-in methods
        delete window.URL.revokeObjectURL;
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
            '(required) Server version, license details, system diagnostics, sanitized configuration, usage counts, job status, permissions, plugin list, database schema, and performance profiles. Does not include message content.',
        );
        expect(screen.getByRole('checkbox', {name: 'Server logs'})).toHaveAccessibleDescription(
            'Recent server log files, including any advanced and audit log files. May contain usernames, email addresses, IP addresses, and error details.',
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
            'Usage counts and settings from installed plugins',
            'Database table structure (no data)',
            'Performance profiles (CPU, memory, goroutines)',
        ]);

        await user.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    describe('download', () => {
        let getSupportPacket: jest.SpyInstance;

        beforeEach(() => {
            getSupportPacket = jest.spyOn(Client4, 'getSupportPacket').mockResolvedValue({blob: new Blob(), filename: 'packet.zip'});
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        const renderAndDownload = async (props: Partial<typeof baseProps> = {}, user = userEvent.setup()) => {
            const utils = renderWithContext(
                <CommercialSupportModal
                    {...baseProps}
                    {...props}
                />,
            );
            await user.click(screen.getByRole('button', {name: 'Download Support Packet'}));
            return utils;
        };

        const genericError = 'Unable to download the Support Packet. Please try again.';
        const clientError = (message: string, detailedError?: string) => new ClientError('http://localhost:8065', {message, detailed_error: detailedError, url: ''});

        test('should request the selected contents', async () => {
            const user = userEvent.setup();
            renderWithContext(
                <CommercialSupportModal
                    {...baseProps}
                    packetContents={[
                        ...baseProps.packetContents,
                        {id: 'com.mattermost.calls', label: 'Calls', selected: false, mandatory: false},
                        {id: 'com.mattermost.boards', label: 'Boards', selected: false, mandatory: false},
                    ]}
                />,
            );

            await user.click(screen.getByRole('checkbox', {name: 'Server logs'}));
            await user.click(screen.getByRole('checkbox', {name: 'Calls'}));
            await user.click(screen.getByRole('button', {name: 'Download Support Packet'}));

            expect(getSupportPacket).toHaveBeenCalledWith({basicServerLogs: false, pluginPackets: ['com.mattermost.calls']});
        });

        test.each([
            ['message and detailed error', clientError('Failed to download', 'Permission denied'), 'Failed to download: Permission denied'],
            ['message only', clientError('Failed to download', ''), 'Failed to download'],
            ['an empty server error', clientError(''), genericError],
            ['a network error', new TypeError('Failed to fetch'), genericError],
        ])('should show the right error for %s', async (_, err, expected) => {
            getSupportPacket.mockRejectedValue(err);

            await renderAndDownload();

            expect(await screen.findByText(expected)).toBeInTheDocument();
        });

        test('should clear error when starting new download', async () => {
            const ref = React.createRef<CommercialSupportModal>();
            const user = userEvent.setup();
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

            await user.click(screen.getByRole('button', {name: 'Download Support Packet'}));

            await waitFor(() => expect(screen.queryByText('Previous error')).not.toBeInTheDocument());
        });

        test('should download the file and release it from memory afterwards', async () => {
            jest.useFakeTimers();

            await renderAndDownload({}, userEvent.setup({advanceTimers: jest.advanceTimersByTime}));

            await waitFor(() => expect(window.URL.createObjectURL).toHaveBeenCalled());
            expect(window.URL.revokeObjectURL).not.toHaveBeenCalled();

            act(() => {
                jest.runOnlyPendingTimers();
            });
            expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
        });

        test('should still save the file when the modal is closed during the download', async () => {
            let resolve: (packet: {blob: Blob; filename: string}) => void = () => {};
            getSupportPacket.mockReturnValue(new Promise((r) => {
                resolve = r;
            }));

            const ref = React.createRef<CommercialSupportModal>();
            const user = userEvent.setup();
            renderWithContext(
                <CommercialSupportModal
                    {...baseProps}
                    ref={ref}
                />,
            );
            await user.click(screen.getByRole('button', {name: 'Download Support Packet'}));

            act(() => {
                ref.current?.doHide();
            });
            await act(async () => {
                resolve({blob: new Blob(), filename: 'packet.zip'});
            });

            expect(window.URL.createObjectURL).toHaveBeenCalled();
        });

        test('should still save the file when the modal unmounts during the download', async () => {
            let resolve: (packet: {blob: Blob; filename: string}) => void = () => {};
            getSupportPacket.mockReturnValue(new Promise((r) => {
                resolve = r;
            }));
            const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) {
                expect(this.getAttribute('download')).toBe('packet.zip');
            });

            const {unmount} = await renderAndDownload();
            unmount();
            await act(async () => {
                resolve({blob: new Blob(), filename: 'packet.zip'});
            });

            expect(click).toHaveBeenCalledTimes(1);
            click.mockRestore();
        });
    });

    test('should encode the user details in the cloud support link', () => {
        renderWithContext(
            <CommercialSupportModal
                {...baseProps}
                isCloud={true}
                currentUser={TestHelper.getUserMock({first_name: 'Jo & Co', last_name: 'Smith#1', email: 'jo+support@example.com'})}
            />,
        );

        const href = screen.getByRole('link', {name: 'submit a support ticket'}).getAttribute('href')!;
        expect(href).not.toContain('+');
        const params = new URL(href).searchParams;
        expect(params.get('name')).toBe('Jo & Co Smith#1');
        expect(params.get('email')).toBe('jo+support@example.com');
        expect(params.get('inquiry')).toBe('technical');
    });

    test('should not add stray spaces to the name in the cloud support link when a name part is empty', () => {
        renderWithContext(
            <CommercialSupportModal
                {...baseProps}
                isCloud={true}
                currentUser={TestHelper.getUserMock({first_name: 'Jo', last_name: ''})}
            />,
        );

        const href = screen.getByRole('link', {name: 'submit a support ticket'}).getAttribute('href')!;
        expect(new URL(href).searchParams.get('name')).toBe('Jo');
    });

    test('should link to the support portal when not on Cloud', () => {
        renderWithContext(<CommercialSupportModal {...baseProps}/>);

        expect(screen.getByRole('link', {name: 'submit a support ticket'})).toHaveAttribute('href', 'https://support.mattermost.com/hc/en-us/requests/new');
    });

    describe('logging banner', () => {
        const bannerText = /Before downloading the Support Packet/;

        const getState = ({isCloud = false, enableFile = 'false', fileLevel = 'INFO'} = {}) => {
            const currentUser = TestHelper.getUserMock();
            return {
                entities: {
                    general: {
                        config: {EnableFile: enableFile, FileLevel: fileLevel},
                        license: {Cloud: String(isCloud)},
                    },
                    users: {
                        currentUserId: currentUser.id,
                        profiles: {[currentUser.id]: currentUser},
                    },
                    admin: {plugins: {}},
                },
            };
        };

        test('should show the banner with a link to the logging settings when file logging is off', () => {
            renderWithContext(<ConnectedCommercialSupportModal onExited={jest.fn()}/>, getState());

            expect(screen.getByText(bannerText)).toBeInTheDocument();
            expect(screen.getByRole('link', {name: 'here'})).toHaveAttribute('href', '/admin_console/environment/logging');
        });

        test.each([
            ['file logging is on but the level is not DEBUG', {enableFile: 'true', fileLevel: 'INFO'}, true],
            ['file logging is on at DEBUG level', {enableFile: 'true', fileLevel: 'DEBUG'}, false],
            ['the server is on Cloud', {isCloud: true}, false],
        ])('should set banner visibility correctly when %s', (_, state, shown) => {
            renderWithContext(<ConnectedCommercialSupportModal onExited={jest.fn()}/>, getState(state));

            expect(Boolean(screen.queryByText(bannerText))).toBe(shown);
        });

        test('should hide the banner when dismissed', async () => {
            renderWithContext(
                <CommercialSupportModal
                    {...baseProps}
                    showBannerWarning={true}
                />,
            );

            expect(screen.getByText(bannerText)).toBeInTheDocument();

            await userEvent.setup().click(screen.getByRole('button', {name: 'Dismiss'}));

            expect(screen.queryByText(bannerText)).not.toBeInTheDocument();
        });
    });
});
