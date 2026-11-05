// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

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
        // Mock getSystemRoute to return a valid URL
        jest.spyOn(Client4, 'getSystemRoute').mockImplementation(() => 'http://localhost:8065/api/v4/system');

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

    test('should request the packet without a Content-Type header and with an abort signal', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(new Blob()),
            headers: {get: () => null},
        });

        renderWithContext(<CommercialSupportModal {...baseProps}/>);

        await userEvent.setup().click(screen.getByRole('button', {name: 'Download Support Packet'}));

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
        const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url).toBe('http://localhost:8065/api/v4/system/support_packet?basic_server_logs=true');
        expect(options.headers).toBeUndefined();
        expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    test('should show only the message when the server returns no detailed error', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            json: () => Promise.resolve({message: 'Failed to download', detailed_error: ''}),
        });

        renderWithContext(<CommercialSupportModal {...baseProps}/>);

        await userEvent.setup().click(screen.getByRole('button', {name: 'Download Support Packet'}));

        expect(await screen.findByText('Failed to download')).toBeInTheDocument();
    });

    test('should show a generic error when the error response is not JSON', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
        });

        renderWithContext(<CommercialSupportModal {...baseProps}/>);

        await userEvent.setup().click(screen.getByRole('button', {name: 'Download Support Packet'}));

        expect(await screen.findByText('Unable to download the Support Packet. Please try again.')).toBeInTheDocument();
    });

    test('should show a generic error when the request fails', async () => {
        global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

        renderWithContext(<CommercialSupportModal {...baseProps}/>);

        await userEvent.setup().click(screen.getByRole('button', {name: 'Download Support Packet'}));

        expect(await screen.findByText('Unable to download the Support Packet. Please try again.')).toBeInTheDocument();
    });

    test('should release the downloaded file from memory after the download starts', async () => {
        jest.useFakeTimers();
        try {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                blob: () => Promise.resolve(new Blob()),
                headers: {get: () => null},
            });

            renderWithContext(<CommercialSupportModal {...baseProps}/>);

            const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
            await user.click(screen.getByRole('button', {name: 'Download Support Packet'}));

            await waitFor(() => expect(window.URL.createObjectURL).toHaveBeenCalled());
            expect(window.URL.revokeObjectURL).not.toHaveBeenCalled();

            act(() => {
                jest.runOnlyPendingTimers();
            });
            expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
        } finally {
            jest.useRealTimers();
        }
    });

    test('should abort the download when the modal unmounts', async () => {
        let signal: AbortSignal | undefined;
        global.fetch = jest.fn().mockImplementation((_url: string, options: RequestInit) => {
            signal = options.signal ?? undefined;
            return new Promise(() => {}); // never resolves
        });

        const {unmount} = renderWithContext(<CommercialSupportModal {...baseProps}/>);

        await userEvent.setup().click(screen.getByRole('button', {name: 'Download Support Packet'}));
        await waitFor(() => expect(signal).toBeDefined());
        expect(signal?.aborted).toBe(false);

        unmount();

        expect(signal?.aborted).toBe(true);
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

        test('should show the banner when file logging is on but the level is not DEBUG', () => {
            renderWithContext(<ConnectedCommercialSupportModal onExited={jest.fn()}/>, getState({enableFile: 'true', fileLevel: 'INFO'}));

            expect(screen.getByText(bannerText)).toBeInTheDocument();
        });

        test('should not show the banner when file logging is on at DEBUG level', () => {
            renderWithContext(<ConnectedCommercialSupportModal onExited={jest.fn()}/>, getState({enableFile: 'true', fileLevel: 'DEBUG'}));

            expect(screen.queryByText(bannerText)).not.toBeInTheDocument();
        });

        test('should not show the banner on Cloud', () => {
            renderWithContext(<ConnectedCommercialSupportModal onExited={jest.fn()}/>, getState({isCloud: true}));

            expect(screen.queryByText(bannerText)).not.toBeInTheDocument();
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
