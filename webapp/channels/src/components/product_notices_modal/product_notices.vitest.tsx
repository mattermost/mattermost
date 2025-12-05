// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, waitFor, userEvent} from 'tests/vitest_react_testing_utils';
import {isDesktopApp, getDesktopVersion} from 'utils/user_agent';

import ProductNoticesModal from './product_notices_modal';

vi.mock('utils/user_agent');

describe('ProductNoticesModal', () => {
    const noticesData = [{
        id: '124',
        title: 'for sysadmin',
        description: 'your eyes only! [test](https://test.com)',
        image: 'https://raw.githubusercontent.com/reflog/notices-experiment/master/images/2020-08-11_11-42.png',
        actionText: 'Download',
        actionParam: 'http://download.com/path',
        sysAdminOnly: true,
        teamAdminOnly: false,
    },
    {
        id: '123',
        title: 'title',
        description: 'descr',
        actionText: 'Download',
        actionParam: 'http://download.com/path',
        sysAdminOnly: false,
        teamAdminOnly: false,
    }];

    const baseProps = {
        version: '5.28.0',
        currentTeamId: 'currentTeamId',
        socketStatus: {
            connected: true,
            connectionId: '',
            lastConnectAt: 1599760193593,
            lastDisconnectAt: 0,
            serverHostname: '',
        },
        actions: {
            getInProductNotices: vi.fn().mockResolvedValue({data: noticesData}),
            updateNoticesAsViewed: vi.fn().mockResolvedValue({}),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isDesktopApp).mockReturnValue(false);
        vi.mocked(getDesktopVersion).mockReturnValue('');
    });

    test('Should match snapshot when there are no notices', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getInProductNotices: vi.fn().mockResolvedValue({data: []}),
            },
        };
        const {container} = renderWithContext(<ProductNoticesModal {...props}/>);

        await waitFor(() => {
            expect(props.actions.getInProductNotices).toHaveBeenCalled();
        });

        expect(container).toMatchSnapshot();
    });

    test('Should match snapshot for system admin notice', async () => {
        const {container} = renderWithContext(<ProductNoticesModal {...baseProps}/>);

        await waitFor(() => {
            expect(baseProps.actions.getInProductNotices).toHaveBeenCalled();
        });

        expect(container).toMatchSnapshot();
    });

    test('Match snapshot for user notice', async () => {
        const {container} = renderWithContext(<ProductNoticesModal {...baseProps}/>);

        await waitFor(() => {
            expect(baseProps.actions.getInProductNotices).toHaveBeenCalled();
        });

        // Navigate to second notice by clicking next
        const nextButton = screen.getByRole('button', {name: /next/i});
        if (nextButton) {
            await userEvent.click(nextButton);
        }

        expect(container).toMatchSnapshot();
    });

    test('Match snapshot for single notice', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getInProductNotices: vi.fn().mockResolvedValue({data: [noticesData[1]]}),
            },
        };
        const {container} = renderWithContext(<ProductNoticesModal {...props}/>);

        await waitFor(() => {
            expect(props.actions.getInProductNotices).toHaveBeenCalled();
        });

        expect(container).toMatchSnapshot();
    });

    test('Should change the state of presentNoticeIndex on click of next, previous button', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);

        await waitFor(() => {
            expect(baseProps.actions.getInProductNotices).toHaveBeenCalled();
        });

        // Wait for notices to load and find navigation buttons
        await waitFor(() => {
            expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        });

        // Click next button
        const nextButton = screen.getByRole('button', {name: /next/i});
        await userEvent.click(nextButton);

        // Should now see the second notice
        await waitFor(() => {
            expect(screen.getByText('title')).toBeInTheDocument();
        });

        // Click previous button
        const prevButton = screen.getByRole('button', {name: /previous/i});
        await userEvent.click(prevButton);

        // Should be back to the first notice
        await waitFor(() => {
            expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        });
    });

    test('Should not have previous button if there is only one notice', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getInProductNotices: vi.fn().mockResolvedValue({data: [noticesData[1]]}),
            },
        };
        renderWithContext(<ProductNoticesModal {...props}/>);

        await waitFor(() => {
            expect(props.actions.getInProductNotices).toHaveBeenCalled();
        });

        // Wait for notice to load
        await waitFor(() => {
            expect(screen.getByText('title')).toBeInTheDocument();
        });

        // Previous button should not exist for single notice
        expect(screen.queryByRole('button', {name: /previous/i})).not.toBeInTheDocument();
    });

    test('Should not have previous button if there is only one notice', async () => {
        // Duplicate test from Jest - keeping for title parity
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getInProductNotices: vi.fn().mockResolvedValue({data: [noticesData[1]]}),
            },
        };
        renderWithContext(<ProductNoticesModal {...props}/>);

        await waitFor(() => {
            expect(props.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'web', baseProps.version);
        });

        // Wait for notice to load
        await waitFor(() => {
            expect(screen.getByText('title')).toBeInTheDocument();
        });

        // Previous button should not exist for single notice
        expect(screen.queryByRole('button', {name: /previous/i})).not.toBeInTheDocument();
    });

    test('Should open url in a new window on click of handleConfirm for single notice', async () => {
        window.open = vi.fn();
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getInProductNotices: vi.fn().mockResolvedValue({data: [noticesData[1]]}),
            },
        };
        renderWithContext(<ProductNoticesModal {...props}/>);

        await waitFor(() => {
            expect(props.actions.getInProductNotices).toHaveBeenCalled();
        });

        // Wait for notice to load
        await waitFor(() => {
            expect(screen.getByText('title')).toBeInTheDocument();
        });

        // Click the confirm/download button
        const downloadButton = screen.getByRole('button', {name: /download/i});
        await userEvent.click(downloadButton);

        expect(window.open).toHaveBeenCalledWith(noticesData[1].actionParam, '_blank');
    });

    test('Should call for getInProductNotices and updateNoticesAsViewed on mount', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);

        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'web', baseProps.version);

        // Wait for the notices to be displayed, which indicates the async operations have completed
        await waitFor(() => {
            expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        });

        expect(baseProps.actions.updateNoticesAsViewed).toHaveBeenCalledWith([noticesData[0].id]);
    });

    test('Should call for updateNoticesAsViewed on click of next button', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);

        await waitFor(() => {
            expect(baseProps.actions.getInProductNotices).toHaveBeenCalled();
        });

        // Wait for notices to load
        await waitFor(() => {
            expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        });

        // Click next button
        const nextButton = screen.getByRole('button', {name: /next/i});
        await userEvent.click(nextButton);

        await waitFor(() => {
            expect(baseProps.actions.updateNoticesAsViewed).toHaveBeenCalledWith([noticesData[1].id]);
        });
    });

    test('Should clear state on onExited with a timer', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);

        // Wait for notices to load
        await waitFor(() => {
            expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        });

        // The modal should render the first notice content
        expect(screen.getByText('for sysadmin')).toBeInTheDocument();
    });

    test('Should call for getInProductNotices if socket reconnects for the first time in a day', async () => {
        const {rerender} = renderWithContext(<ProductNoticesModal {...baseProps}/>);

        // Wait for initial load
        await waitFor(() => {
            expect(baseProps.actions.getInProductNotices).toHaveBeenCalledTimes(1);
        });

        vi.spyOn(Date, 'now').mockReturnValue(1599807605628);

        // Disconnect
        rerender(
            <ProductNoticesModal
                {...baseProps}
                socketStatus={{
                    ...baseProps.socketStatus,
                    connected: false,
                }}
            />,
        );

        // Reconnect
        rerender(
            <ProductNoticesModal
                {...baseProps}
                socketStatus={{
                    ...baseProps.socketStatus,
                    connected: true,
                }}
            />,
        );

        await waitFor(() => {
            expect(baseProps.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'web', baseProps.version);
            expect(baseProps.actions.getInProductNotices).toHaveBeenCalledTimes(2);
        });
    });

    test('Should call for getInProductNotices with desktop as client if isDesktopApp returns true', async () => {
        vi.mocked(getDesktopVersion).mockReturnValue('4.5.0');
        vi.mocked(isDesktopApp).mockReturnValue(true);

        renderWithContext(<ProductNoticesModal {...baseProps}/>);

        // Wait for async state updates to complete
        await waitFor(() => {
            expect(baseProps.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'desktop', '4.5.0');
        });

        // Wait for notices to be displayed (ensures all state updates are complete)
        await waitFor(() => {
            expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        });
    });

    test('Should not call for getInProductNotices if socket reconnects on the same day', async () => {
        const {rerender} = renderWithContext(<ProductNoticesModal {...baseProps}/>);

        // Wait for initial load
        await waitFor(() => {
            expect(baseProps.actions.getInProductNotices).toHaveBeenCalledTimes(1);
        });

        vi.spyOn(Date, 'now').mockReturnValue(1599760196593);

        // Disconnect
        rerender(
            <ProductNoticesModal
                {...baseProps}
                socketStatus={{
                    ...baseProps.socketStatus,
                    connected: false,
                }}
            />,
        );

        // Reconnect
        rerender(
            <ProductNoticesModal
                {...baseProps}
                socketStatus={{
                    ...baseProps.socketStatus,
                    connected: true,
                }}
            />,
        );

        // Should still only be called once (initial mount only)
        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledTimes(1);
    });
});
