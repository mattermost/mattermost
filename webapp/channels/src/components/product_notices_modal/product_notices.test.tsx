// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {GenericModal} from '@mattermost/components';

import {isDesktopApp, getDesktopVersion} from 'utils/user_agent';
import {renderWithContext} from 'tests/react_testing_utils';

import ProductNoticesModal from './product_notices_modal';

jest.mock('utils/user_agent');

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
        },
        actions: {
            getInProductNotices: jest.fn().mockResolvedValue({data: noticesData}),
            updateNoticesAsViewed: jest.fn().mockResolvedValue({}),
        },
    };

    test('should render correctly with no notices', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('should render correctly for system admin notice', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        
        expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        expect(screen.getByText(/your eyes only!/i)).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'test'})).toHaveAttribute('href', 'https://test.com');
    });

    test('should render correctly for user notice', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        
        const nextButton = screen.getByRole('button', {name: /next/i});
        await userEvent.click(nextButton);
        
        expect(screen.getByText('title')).toBeInTheDocument();
        expect(screen.getByText('descr')).toBeInTheDocument();
    });

    test('should render correctly for single notice', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getInProductNotices: jest.fn().mockResolvedValue({data: [noticesData[1]]}),
            },
        };
        renderWithContext(<ProductNoticesModal {...props}/>);
        await props.actions.getInProductNotices();
        
        expect(screen.getByText('title')).toBeInTheDocument();
        expect(screen.getByText('descr')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /previous/i})).not.toBeInTheDocument();
    });

    test('should handle navigation between notices correctly', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        
        expect(screen.getByText('for sysadmin')).toBeInTheDocument();
        
        const nextButton = screen.getByRole('button', {name: /next/i});
        await userEvent.click(nextButton);
        
        expect(screen.getByText('title')).toBeInTheDocument();
        
        const prevButton = screen.getByRole('button', {name: /previous/i});
        await userEvent.click(prevButton);
        
        expect(screen.getByText('for sysadmin')).toBeInTheDocument();
    });

    test('should not show previous button for single notice', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getInProductNotices: jest.fn().mockResolvedValue({data: [noticesData[1]]}),
            },
        };
        renderWithContext(<ProductNoticesModal {...props}/>);
        await props.actions.getInProductNotices();
        
        expect(screen.queryByRole('button', {name: /previous/i})).not.toBeInTheDocument();
    });

    test('should open url in new window when clicking action button for single notice', async () => {
        window.open = jest.fn();
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getInProductNotices: jest.fn().mockResolvedValue({data: [noticesData[1]]}),
            },
        };
        renderWithContext(<ProductNoticesModal {...props}/>);
        await props.actions.getInProductNotices();
        
        const actionButton = screen.getByRole('button', {name: 'Download'});
        await userEvent.click(actionButton);
        
        expect(window.open).toHaveBeenCalledWith(noticesData[1].actionParam, '_blank');
    });

    test('should call getInProductNotices and updateNoticesAsViewed on mount', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);
        
        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'web', baseProps.version);
        await baseProps.actions.getInProductNotices();
        expect(baseProps.actions.updateNoticesAsViewed).toHaveBeenCalledWith([noticesData[0].id]);
    });

    test('should call updateNoticesAsViewed when navigating to next notice', async () => {
        renderWithContext(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        
        const nextButton = screen.getByRole('button', {name: /next/i});
        await userEvent.click(nextButton);
        
        expect(baseProps.actions.updateNoticesAsViewed).toHaveBeenCalledWith([noticesData[1].id]);
    });

    test('should clear modal content when closed', async () => {
        jest.useFakeTimers();
        renderWithContext(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        
        const closeButton = screen.getByRole('button', {name: /close/i});
        await userEvent.click(closeButton);
        
        jest.runOnlyPendingTimers();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('should fetch notices on socket reconnect if first time in a day', async () => {
        const {rerender} = renderWithContext(<ProductNoticesModal {...baseProps}/>);
        Date.now = jest.fn().mockReturnValue(1599807605628);
        
        rerender(<ProductNoticesModal
            {...baseProps}
            socketStatus={{...baseProps.socketStatus, connected: false}}
        />);

        rerender(<ProductNoticesModal
            {...baseProps}
            socketStatus={{...baseProps.socketStatus, connected: true}}
        />);

        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'web', baseProps.version);
        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledTimes(2);
    });

    test('should use desktop client type when running in desktop app', () => {
        (getDesktopVersion as jest.Mock).mockReturnValue('4.5.0');
        (isDesktopApp as jest.Mock).mockReturnValue(true);
        
        renderWithContext(<ProductNoticesModal {...baseProps}/>);
        
        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'desktop', '4.5.0');
    });

    test('should not fetch notices on socket reconnect if same day', async () => {
        const {rerender} = renderWithContext(<ProductNoticesModal {...baseProps}/>);
        Date.now = jest.fn().mockReturnValue(1599760196593);
        
        rerender(<ProductNoticesModal
            {...baseProps}
            socketStatus={{...baseProps.socketStatus, connected: false}}
        />);

        rerender(<ProductNoticesModal
            {...baseProps}
            socketStatus={{...baseProps.socketStatus, connected: true}}
        />);

        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledTimes(1);
    });
});
