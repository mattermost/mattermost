// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps} from 'react';
import {fireEvent, screen} from '@testing-library/react';
import * as reactRedux from 'react-redux';

import {renderWithIntl} from 'tests/react_testing_utils';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {trackEvent} from 'actions/telemetry_actions';
import configureStore from 'store';
import {ModalIdentifiers, Preferences, TELEMETRY_CATEGORIES} from 'utils/constants';

import DeliquencyModal from './delinquency_modal';

type RenderComponentArgs = {
    props?: Partial<ComponentProps<typeof DeliquencyModal>>;
    store?: any;
}

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(),
}));

jest.mock('actions/telemetry_actions', () => ({
    trackEvent: jest.fn(),
}));

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(),
}));

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn().mockReturnValue(() => {}),
}));

describe('components/deliquency_modal/deliquency_modal', () => {
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
        const defaultProps: ComponentProps<typeof DeliquencyModal> = {
            closeModal: jest.fn(),
            onExited: jest.fn(),
            planName: 'planName',
            isAdminConsole: false,
        };

        return renderWithIntl(
            <reactRedux.Provider store={store}>
                <DeliquencyModal
                    {...defaultProps}
                    {...props}
                />
            </reactRedux.Provider>,
        );
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should save preferences and track stayOnFremium if admin click Stay on Free', () => {
        renderComponent({});

        fireEvent.click(screen.getByText('Stay on Free'));

        expect(savePreferences).toBeCalledTimes(1);
        expect(savePreferences).toBeCalledWith(initialStates.entities.users.profiles.current_user_id.id, [{
            category: Preferences.DELINQUENCY_MODAL_CONFIRMED,
            name: ModalIdentifiers.DELINQUENCY_MODAL_DOWNGRADE,
            user_id: initialStates.entities.users.profiles.current_user_id.id,
            value: 'stayOnFremium',
        }]);

        expect(trackEvent).toBeCalledTimes(1);
        expect(trackEvent).toBeCalledWith(TELEMETRY_CATEGORIES.CLOUD_DELINQUENCY, 'clicked_stay_on_freemium');
    });

    it('should save preferences and track update Billing if admin click Update Billing', () => {
        renderComponent({});

        fireEvent.click(screen.getByText('Update Billing'));

        expect(savePreferences).toBeCalledTimes(1);
        expect(savePreferences).toBeCalledWith(initialStates.entities.users.profiles.current_user_id.id, [{
            category: Preferences.DELINQUENCY_MODAL_CONFIRMED,
            name: ModalIdentifiers.DELINQUENCY_MODAL_DOWNGRADE,
            user_id: initialStates.entities.users.profiles.current_user_id.id,
            value: 'updateBilling',
        }]);

        expect(trackEvent).toBeCalledTimes(2);
        expect(trackEvent).toHaveBeenNthCalledWith(1, TELEMETRY_CATEGORIES.CLOUD_DELINQUENCY, 'clicked_update_billing');
        expect(trackEvent).toHaveBeenNthCalledWith(2, TELEMETRY_CATEGORIES.CLOUD_ADMIN, 'click_open_delinquency_modal', {
            callerInfo: 'delinquency_modal_downgrade_admin',
        });
    });
});
