// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isDesktopApp, getDesktopVersion} from '@mattermost/shared/utils/user_agent';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import ProductNoticesModal from './product_notices_modal';

const getDesktopVersionMock = jest.mocked(getDesktopVersion);
const isDesktopAppMock = jest.mocked(isDesktopApp);
jest.mock('@mattermost/shared/utils/user_agent', () => ({
    getDesktopVersion: jest.fn(),
    isDesktopApp: jest.fn(),
}));

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
            getInProductNotices: jest.fn().mockResolvedValue({data: noticesData}),
            updateNoticesAsViewed: jest.fn().mockResolvedValue({}),
        },
    };

    beforeEach(() => {
        baseProps.actions.getInProductNotices.mockClear();
        baseProps.actions.updateNoticesAsViewed.mockClear();
        isDesktopAppMock.mockReset();
        getDesktopVersionMock.mockReset();
    });

    test('Should match snapshot when there are no notices', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getInProductNotices: jest.fn().mockReturnValue(new Promise(() => {})),
            },
        };
        const {baseElement} = renderWithContext(<ProductNoticesModal {...props}/>);
        expect(baseElement).toMatchSnapshot();
    });

    test('Should match snapshot for system admin notice', async () => {
        const {baseElement} = renderWithContext(<ProductNoticesModal {...baseProps}/>);
        await waitFor(() => {
            expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        });
        expect(baseElement).toMatchSnapshot();
    });

    test('Match snapshot for user notice', async () => {
        const ref = React.createRef<ProductNoticesModal>();
        const {baseElement} = renderWithContext(
            <ProductNoticesModal
                ref={ref}
                {...baseProps}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        });

        // Navigate to second notice
        act(() => {
            ref.current!.setState({presentNoticeIndex: 1});
        });
        expect(baseElement).toMatchSnapshot();
    });

    test('Match snapshot for single notice', async () => {
        const singleNoticeProps = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getInProductNotices: jest.fn().mockResolvedValue({data: [noticesData[1]]}),
            },
        };
        const {baseElement} = renderWithContext(<ProductNoticesModal {...singleNoticeProps}/>);
        await waitFor(() => {
            expect(screen.getByText('title')).toBeInTheDocument();
        });
        expect(baseElement).toMatchSnapshot();
    });

    test('Should change the state of presentNoticeIndex on click of next, previous button', async () => {
        const ref = React.createRef<ProductNoticesModal>();
        renderWithContext(
            <ProductNoticesModal
                ref={ref}
                {...baseProps}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        });
        expect(ref.current!.state.presentNoticeIndex).toBe(0);
        await userEvent.click(screen.getByText('Next'));
        expect(ref.current!.state.presentNoticeIndex).toBe(1);
        await userEvent.click(screen.getByText('Previous'));
        expect(ref.current!.state.presentNoticeIndex).toBe(0);
    });

    test('Should not have previous button if there is only one notice', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);
        await waitFor(() => {
            expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        });
        expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    });

    test('Should open url in a new window on click of handleConfirm for single notice', async () => {
        window.open = jest.fn();
        const singleNoticeProps = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getInProductNotices: jest.fn().mockResolvedValue({data: [noticesData[1]]}),
            },
        };
        renderWithContext(<ProductNoticesModal {...singleNoticeProps}/>);
        await waitFor(() => {
            expect(screen.getByText('title')).toBeInTheDocument();
        });

        // For single notice with actionText, confirm button shows action text
        await userEvent.click(screen.getByRole('button', {name: 'Download'}));
        expect(window.open).toHaveBeenCalledWith(noticesData[1].actionParam, '_blank');
    });

    test('Should call for getInProductNotices and updateNoticesAsViewed on mount', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);
        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'web', baseProps.version);
        await waitFor(() => {
            expect(baseProps.actions.updateNoticesAsViewed).toHaveBeenCalledWith([noticesData[0].id]);
        });
    });

    test('Should call for updateNoticesAsViewed on click of next button', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);
        await waitFor(() => {
            expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        });
        baseProps.actions.updateNoticesAsViewed.mockClear();
        await userEvent.click(screen.getByText('Next'));
        expect(baseProps.actions.updateNoticesAsViewed).toHaveBeenCalledWith([noticesData[1].id]);
    });

    test('Should clear state on onExited with a timer', async () => {
        jest.useFakeTimers();
        const ref = React.createRef<ProductNoticesModal>();
        renderWithContext(
            <ProductNoticesModal
                ref={ref}
                {...baseProps}
            />,
        );
        await waitFor(() => {
            expect(ref.current!.state.noticesData.length).toBeGreaterThan(0);
        });
        act(() => {
            ref.current!.onModalDismiss();
        });
        act(() => {
            jest.runOnlyPendingTimers();
        });
        expect(ref.current!.state.noticesData).toEqual([]);
        expect(ref.current!.state.presentNoticeIndex).toEqual(0);
        jest.useRealTimers();
    });

    test('Should call for getInProductNotices if socket reconnects for the first time in a day', async () => {
        const ref = React.createRef<ProductNoticesModal>();
        const {rerender} = renderWithContext(
            <ProductNoticesModal
                ref={ref}
                {...baseProps}
            />,
        );

        // Use a timestamp clearly on a different day than lastConnectAt (Sep 10 UTC)
        // in any timezone. Sep 12 00:00 UTC ensures different day even in UTC-12.
        Date.now = jest.fn().mockReturnValue(1599868800000);

        // Simulate socket disconnect
        rerender(
            <ProductNoticesModal
                ref={ref}
                {...baseProps}
                socketStatus={{
                    ...baseProps.socketStatus,
                    connected: false,
                }}
            />,
        );

        // Simulate socket reconnect
        rerender(
            <ProductNoticesModal
                ref={ref}
                {...baseProps}
                socketStatus={{
                    ...baseProps.socketStatus,
                    connected: true,
                }}
            />,
        );

        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'web', baseProps.version);
        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledTimes(2);
    });

    test('Should call for getInProductNotices with desktop as client if isDesktopApp returns true', () => {
        getDesktopVersionMock.mockReturnValue('4.5.0');
        isDesktopAppMock.mockReturnValue(true);
        renderWithContext(<ProductNoticesModal {...baseProps}/>);
        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'desktop', '4.5.0');
    });

    test('Should not call for getInProductNotices if socket reconnects on the same day', async () => {
        const ref = React.createRef<ProductNoticesModal>();
        const {rerender} = renderWithContext(
            <ProductNoticesModal
                ref={ref}
                {...baseProps}
            />,
        );
        Date.now = jest.fn().mockReturnValue(1599760196593);

        // Simulate socket disconnect
        rerender(
            <ProductNoticesModal
                ref={ref}
                {...baseProps}
                socketStatus={{
                    ...baseProps.socketStatus,
                    connected: false,
                }}
            />,
        );

        // Simulate socket reconnect on the same day
        rerender(
            <ProductNoticesModal
                ref={ref}
                {...baseProps}
                socketStatus={{
                    ...baseProps.socketStatus,
                    connected: true,
                }}
            />,
        );

        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledTimes(1);
    });
});
