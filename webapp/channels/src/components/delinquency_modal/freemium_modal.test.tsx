// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {trackEvent} from 'actions/telemetry_actions';

import useGetMultiplesExceededCloudLimit from 'components/common/hooks/useGetMultiplesExceededCloudLimit';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';
import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';
import {LimitTypes} from 'utils/limits';

import type {GlobalState} from 'types/store';

import {FreemiumModal} from './freemium_modal';

jest.mock('actions/telemetry_actions', () => ({
    trackEvent: jest.fn(),
}));

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn().mockReturnValue(() => {}),
}));

jest.mock('components/common/hooks/useGetMultiplesExceededCloudLimit');

describe('components/delinquency_modal/freemium_modal', () => {
    const initialState: DeepPartial<GlobalState> = {
        views: {
            modals: {
                modalState: {
                    [ModalIdentifiers.DELINQUENCY_MODAL_DOWNGRADE]: {
                        open: true,
                        dialogProps: {
                            planName: 'plan_name',
                            onExited: () => {},
                            closeModal: () => {},
                            isAdminConsole: false,
                        },
                        dialogType: React.Fragment as any,
                    },
                },
                showLaunchingWorkspace: false,
            },
        },
        entities: {
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_admin', id: 'test'},
                },
            },
        },
    };

    const planName = 'Testing';
    const baseProps: ComponentProps<typeof FreemiumModal> = {
        onClose: jest.fn(),
        planName,
        isAdminConsole: false,
        onExited: jest.fn(),
    };

    it('should track reactivate plan if admin click Re activate plan', () => {
        (useGetMultiplesExceededCloudLimit as jest.Mock).mockReturnValue([LimitTypes.fileStorage]);
        renderWithContext(
            <FreemiumModal {...baseProps}/>,
            initialState,
        );

        fireEvent.click(screen.getByText(`Re-activate ${planName}`));

        expect(trackEvent).toBeCalledTimes(2);
        expect(trackEvent).toHaveBeenNthCalledWith(1, TELEMETRY_CATEGORIES.CLOUD_DELINQUENCY, 'clicked_re_activate_plan');
        expect(trackEvent).toHaveBeenNthCalledWith(2, TELEMETRY_CATEGORIES.CLOUD_ADMIN, 'click_open_delinquency_modal', {
            callerInfo: 'delinquency_modal_freemium_admin',
        });
    });

    it('should not show reactivate plan if admin limits isn\'t surpassed', () => {
        (useGetMultiplesExceededCloudLimit as jest.Mock).mockReturnValue([]);
        renderWithContext(
            <FreemiumModal {...baseProps}/>,
            initialState,
        );

        expect(screen.queryByText(`Re-activate ${planName}`)).not.toBeInTheDocument();

        expect(trackEvent).toBeCalledTimes(0);
    });

    it('should display message history text when only message limit is surpassed', () => {
        (useGetMultiplesExceededCloudLimit as jest.Mock).mockReturnValue([LimitTypes.messageHistory]);
        renderWithContext(
            <FreemiumModal {...baseProps}/>,
            initialState,
        );

        expect(screen.queryByText(`Re-activate ${planName}`)).toBeInTheDocument();
        expect(screen.getByText('Some of your workspace\'s message history are no longer accessible. Upgrade to a paid plan and get unlimited access to your message history.')).toBeInTheDocument();
    });

    it('should display storage text when only storage is surpassed', () => {
        (useGetMultiplesExceededCloudLimit as jest.Mock).mockReturnValue([LimitTypes.fileStorage]);
        renderWithContext(
            <FreemiumModal {...baseProps}/>,
            initialState,
        );

        expect(screen.queryByText(`Re-activate ${planName}`)).toBeInTheDocument();
        expect(screen.getByText('Some of your workspace\'s files are no longer accessible. Upgrade to a paid plan and get unlimited access to your files.')).toBeInTheDocument();
    });

    it('should display update to paid plan text when only multiples limits is surpassed', () => {
        (useGetMultiplesExceededCloudLimit as jest.Mock).mockReturnValue([LimitTypes.messageHistory, LimitTypes.fileStorage]);
        renderWithContext(
            <FreemiumModal {...baseProps}/>,
            initialState,
        );

        expect(screen.queryByText(`Re-activate ${planName}`)).toBeInTheDocument();
        expect(screen.getByText('Your workspace has reached free plan limits. Upgrade to a paid plan.')).toBeInTheDocument();
    });
});
