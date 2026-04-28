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
            {id: 'basic.server.logs', label: 'Server Logs', selected: true, mandatory: true},
        ],
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<CommercialSupportModal {...baseProps}/>);
        expect(container).toMatchSnapshot();
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
        const downloadLink = screen.getByText('Download Support Packet').closest('a');
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
        const downloadLink = screen.getByText('Download Support Packet').closest('a');
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
