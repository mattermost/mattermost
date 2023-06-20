// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps} from 'react';
import * as reactRedux from 'react-redux';

import {fireEvent, renderWithIntl, screen} from 'tests/react_testing_utils';
import {trackEvent} from 'actions/telemetry_actions';
import configureStore from 'store';
import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';
import useGetMultiplesExceededCloudLimit from 'components/common/hooks/useGetMultiplesExceededCloudLimit';
import {LimitTypes} from 'utils/limits';

import {FreemiumModal} from './freemium_modal';

type RenderComponentArgs = {
    props?: Partial<ComponentProps<typeof FreemiumModal>>;
    store?: any;
}

jest.mock('actions/telemetry_actions', () => ({
    trackEvent: jest.fn(),
}));

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn().mockReturnValue(() => {}),
}));

jest.mock('components/common/hooks/useGetMultiplesExceededCloudLimit');

describe('components/delinquency_modal/freemium_modal', () => {
    const initialStates = {
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
                        dialogType: React.Fragment,
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

    const renderComponent = ({props = {}, store = configureStore(initialStates)}: RenderComponentArgs) => {
        const defaultProps: ComponentProps<typeof FreemiumModal> = {
            onClose: jest.fn(),
            planName: 'planName',
            isAdminConsole: false,
            onExited: jest.fn(),
        };

        return renderWithIntl(
            <reactRedux.Provider store={store}>
                <FreemiumModal
                    {...defaultProps}
                    {...props}
                />
            </reactRedux.Provider>,
        );
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should track reactivate plan if admin click Re activate plan', () => {
        const planName = 'Testing';
        (useGetMultiplesExceededCloudLimit as jest.Mock).mockReturnValue([LimitTypes.fileStorage]);
        renderComponent({
            props: {
                planName,
            },
        });

        fireEvent.click(screen.getByText(`Re-activate ${planName}`));

        expect(trackEvent).toBeCalledTimes(2);
        expect(trackEvent).toHaveBeenNthCalledWith(1, TELEMETRY_CATEGORIES.CLOUD_DELINQUENCY, 'clicked_re_activate_plan');
        expect(trackEvent).toHaveBeenNthCalledWith(2, TELEMETRY_CATEGORIES.CLOUD_ADMIN, 'click_open_delinquency_modal', {
            callerInfo: 'delinquency_modal_freemium_admin',
        });
    });

    it('should not show reactivate plan if admin limits isn\'t surpassed', () => {
        const planName = 'Testing';
        (useGetMultiplesExceededCloudLimit as jest.Mock).mockReturnValue([]);
        renderComponent({
            props: {
                planName,
            },
        });

        expect(screen.queryByText(`Re-activate ${planName}`)).not.toBeInTheDocument();

        expect(trackEvent).toBeCalledTimes(0);
    });

    it('should display message history text when only message limit is surpassed', () => {
        const planName = 'Testing';

        (useGetMultiplesExceededCloudLimit as jest.Mock).mockReturnValue([LimitTypes.messageHistory]);
        renderComponent({
            props: {
                planName,
            },
        });

        expect(screen.queryByText(`Re-activate ${planName}`)).toBeInTheDocument();
        expect(screen.getByText('Some of your workspace\'s message history are no longer accessible. Upgrade to a paid plan and get unlimited access to your message history.')).toBeInTheDocument();
    });

    it('should display storage text when only storage is surpassed', () => {
        const planName = 'Testing';

        (useGetMultiplesExceededCloudLimit as jest.Mock).mockReturnValue([LimitTypes.fileStorage]);
        renderComponent({
            props: {
                planName,
            },
        });

        expect(screen.queryByText(`Re-activate ${planName}`)).toBeInTheDocument();
        expect(screen.getByText('Some of your workspace\'s files are no longer accessible. Upgrade to a paid plan and get unlimited access to your files.')).toBeInTheDocument();
    });

    it('should display update to paid plan text when only multiples limits is surpassed', () => {
        const planName = 'Testing';

        (useGetMultiplesExceededCloudLimit as jest.Mock).mockReturnValue([LimitTypes.messageHistory, LimitTypes.fileStorage]);
        renderComponent({
            props: {
                planName,
            },
        });

        expect(screen.queryByText(`Re-activate ${planName}`)).toBeInTheDocument();
        expect(screen.getByText('Your workspace has reached free plan limits. Upgrade to a paid plan.')).toBeInTheDocument();
    });
});
