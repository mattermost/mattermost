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
            {id: 'basic.server.logs', label: 'Server Logs', selected: true, mandatory: false},
        ],
    };

    test('should render packet content checkboxes with mandatory disabled', () => {
        renderWithContext(<CommercialSupportModal {...baseProps}/>);

        const basicContents = screen.getByRole('checkbox', {name: 'Basic contents'});
        const serverLogs = screen.getByRole('checkbox', {name: 'Server Logs'});

        expect(basicContents).toBeChecked();
        expect(basicContents).toBeDisabled();
        expect(serverLogs).toBeChecked();
        expect(serverLogs).toBeEnabled();
    });

    test('should toggle optional packet content checkbox', async () => {
        renderWithContext(<CommercialSupportModal {...baseProps}/>);

        const user = userEvent.setup();
        const serverLogs = screen.getByRole('checkbox', {name: 'Server Logs'});

        expect(serverLogs).toBeChecked();
        await user.click(serverLogs);
        expect(serverLogs).not.toBeChecked();
        await user.click(serverLogs);
        expect(serverLogs).toBeChecked();
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

            await user.click(screen.getByRole('checkbox', {name: 'Server Logs'}));
            await user.click(screen.getByRole('checkbox', {name: 'Calls'}));
            await user.click(screen.getByRole('button', {name: 'Download Support Packet'}));

            expect(getSupportPacket).toHaveBeenCalledWith({basicServerLogs: false, pluginPackets: ['com.mattermost.calls']}, expect.any(AbortSignal));
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

        test('should abort the download as soon as the modal is closed', async () => {
            getSupportPacket.mockReturnValue(new Promise(() => {})); // never resolves

            const ref = React.createRef<CommercialSupportModal>();
            const user = userEvent.setup();
            renderWithContext(
                <CommercialSupportModal
                    {...baseProps}
                    ref={ref}
                />,
            );
            await user.click(screen.getByRole('button', {name: 'Download Support Packet'}));
            const signal: AbortSignal = getSupportPacket.mock.calls[0][1];

            act(() => {
                ref.current?.doHide();
            });

            expect(signal.aborted).toBe(true);
            expect(baseProps.onExited).not.toHaveBeenCalled();
        });

        test('should abort the download when the modal unmounts', async () => {
            getSupportPacket.mockReturnValue(new Promise(() => {})); // never resolves

            const {unmount} = await renderAndDownload();
            const signal: AbortSignal = getSupportPacket.mock.calls[0][1];
            expect(signal.aborted).toBe(false);

            unmount();

            expect(signal.aborted).toBe(true);
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
