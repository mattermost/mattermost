// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import StartTrialBtn from 'components/learn_more_trial_modal/start_trial_btn';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

jest.mock('mattermost-redux/actions/general', () => ({
    ...jest.requireActual('mattermost-redux/actions/general'),
    getLicenseConfig: () => ({type: 'adsf'}),
}));

jest.mock('actions/admin_actions', () => ({
    ...jest.requireActual('actions/admin_actions'),
    requestTrialLicense: (requestedUsers: number) => {
        if (requestedUsers === 9001) {
            return {type: 'asdf', data: null, error: {status: 400, message: 'some error'}};
        } else if (requestedUsers === 451) {
            return {type: 'asdf', data: {status: 451}, error: {message: 'some error'}};
        }
        return {type: 'asdf', data: 'ok'};
    },
}));

jest.mock('components/common/hooks/useOpenStartTrialFormModal', () => ({
    __esModule: true,
    default: () => jest.fn(),
}));

describe('components/learn_more_trial_modal/start_trial_btn', () => {
    const state = {
        entities: {
            users: {
                currentUserId: 'current_user_id',
            },
            admin: {
                analytics: {
                    TOTAL_USERS: 9,
                },
                prevTrialLicense: {
                    IsLicensed: 'false',
                },
            },
            general: {
                license: {
                    IsLicensed: 'false',
                },
                config: {
                    TelemetryId: 'test_telemetry_id',
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    learn_more_trial_modal: {
                        open: true,
                    },
                },
            },
        },
    };

    const props = {
        onClick: jest.fn(),
        message: 'Start trial',
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <StartTrialBtn {...props}/>,
            state,
        );
        expect(container).toMatchSnapshot();
    });

    test('should handle on click', async () => {
        const mockOnClick = jest.fn();

        const {container} = renderWithContext(
            <StartTrialBtn
                {...props}
                onClick={mockOnClick}
            />,
            state,
        );

        await userEvent.click(container.querySelector('.btn-secondary')!);

        expect(mockOnClick).toHaveBeenCalled();
    });

    test('should handle on click when rendered as button', async () => {
        const mockOnClick = jest.fn();

        renderWithContext(
            <StartTrialBtn
                {...props}
                renderAsButton={true}
                onClick={mockOnClick}
            />,
            state,
        );

        await userEvent.click(screen.getByRole('button'));

        expect(mockOnClick).toHaveBeenCalled();
    });

    // test('does not show success for embargoed countries', async () => {
    //     const mockOnClick = jest.fn();

    //     const clonedState = JSON.parse(JSON.stringify(state));
    //     clonedState.entities.admin.analytics.TOTAL_USERS = 451;

    //     // Mount the component
    //     const wrapper = mountWithIntl(
    //         <Provider store={mockStore(clonedState)}>
    //             <StartTrialBtn
    //                 {...props}
    //                 onClick={mockOnClick}
    //             />
    //         </Provider>,
    //     );

    //     act(() => {
    //         wrapper.find('.start-trial-btn').simulate('click');
    //     });

    //     expect(mockOnClick).not.toHaveBeenCalled();
    // });
});
