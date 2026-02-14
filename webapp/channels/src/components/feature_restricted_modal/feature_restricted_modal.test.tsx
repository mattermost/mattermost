// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import FeatureRestrictedModal from './feature_restricted_modal';

const mockDispatch = jest.fn();
let mockState: any;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

jest.mock('components/common/hooks/useOpenPricingModal', () => () => ({
    openPricingModal: jest.fn(),
    isAirGapped: false,
}));

jest.mock('components/notify_admin_cta/notify_admin_cta', () => ({
    useNotifyAdmin: () => {
        const {NotifyStatus} = require('components/common/hooks/useGetNotifyAdmin');
        return ['Notify admin', jest.fn(), NotifyStatus.None];
    },
}));

jest.mock('components/learn_more_trial_modal/start_trial_btn', () => (props: {onClick: () => void}) => (
    <button onClick={props.onClick}>{'Try free for 30 days'}</button>
));

jest.mock('@mattermost/components', () => ({
    GenericModal: ({children, modalHeaderText}: {children: React.ReactNode; modalHeaderText?: string}) => (
        <div>
            <h1>{modalHeaderText}</h1>
            {children}
        </div>
    ),
}));

describe('components/global/product_switcher_menu', () => {
    const defaultProps = {
        titleAdminPreTrial: 'Title admin pre trial',
        messageAdminPreTrial: 'Message admin pre trial',
        titleAdminPostTrial: 'Title admin post trial',
        messageAdminPostTrial: 'Message admin post trial',
        titleEndUser: 'Title end user',
        messageEndUser: 'Message end user',
    };

    beforeEach(() => {
        mockState = {
            entities: {
                users: {
                    currentUserId: 'user1',
                    profiles: {
                        current_user_id: {roles: ''},
                        user1: {
                            id: 'user1',
                            roles: '',
                        },
                    },
                },
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                },
                general: {
                    license: {
                        IsLicensed: 'false',
                    },
                },
                cloud: {
                    subscription: {
                        id: 'subId',
                        customer_id: '',
                        product_id: '',
                        add_ons: [],
                        start_at: 0,
                        end_at: 0,
                        create_at: 0,
                        seats: 0,
                        trial_end_at: 0,
                        is_free_trial: '',
                    },
                },
            },
            views: {
                modals: {
                    modalState: {
                        [ModalIdentifiers.FEATURE_RESTRICTED_MODAL]: {
                            open: 'true',
                        },
                    },
                },
            },
        };
    });

    test('should show with end user pre trial', () => {
        const {container} = renderWithContext(<FeatureRestrictedModal {...defaultProps}/>);

        expect(screen.getByText(defaultProps.messageEndUser)).toBeInTheDocument();
        expect(container.querySelector('.FeatureRestrictedModal__terms')).not.toBeInTheDocument();
        expect(container.querySelector('.FeatureRestrictedModal__buttons')).toHaveClass('single');
        expect(screen.getByRole('button', {name: /notify admin/i})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /try free/i})).not.toBeInTheDocument();
    });

    test('should show with end user post trial', () => {
        const {container} = renderWithContext(<FeatureRestrictedModal {...defaultProps}/>);

        expect(screen.getByText(defaultProps.messageEndUser)).toBeInTheDocument();
        expect(container.querySelector('.FeatureRestrictedModal__terms')).not.toBeInTheDocument();
        expect(container.querySelector('.FeatureRestrictedModal__buttons')).toHaveClass('single');
        expect(screen.getByRole('button', {name: /notify admin/i})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /try free/i})).not.toBeInTheDocument();
    });

    test('should show with system admin pre trial for self hosted', () => {
        mockState.entities.users.profiles.user1.roles = 'system_admin';

        const {container} = renderWithContext(<FeatureRestrictedModal {...defaultProps}/>);

        expect(screen.getByText(defaultProps.messageAdminPreTrial)).toBeInTheDocument();
        expect(container.querySelector('.FeatureRestrictedModal__terms')).toBeInTheDocument();
        expect(container.querySelector('.FeatureRestrictedModal__buttons')).not.toHaveClass('single');
        expect(screen.getByRole('button', {name: /view plans/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /try free/i})).toBeInTheDocument();
    });
});
