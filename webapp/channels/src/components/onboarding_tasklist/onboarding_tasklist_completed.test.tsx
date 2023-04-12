// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Completed from './onboarding_tasklist_completed';
import {shallow} from 'enzyme';

let mockState: any;
const mockDispatch = jest.fn();
const dismissMockFn = jest.fn();

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/onboarding_tasklist/onboarding_tasklist_completed.tsx', () => {
    const props = {
        dismissAction: dismissMockFn,
        isCurrentUserSystemAdmin: true,
        isFirstAdmin: true,
    };

    beforeEach(() => {
        mockState = {
            entities: {
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
                        product_id: 'prod_professional',
                        is_free_trial: 'false',
                        trial_end_at: 1,
                    },
                },
            },
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should match snapshot', () => {
        const wrapper = shallow(<Completed {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('finds the completed subtitle', () => {
        const wrapper = shallow(<Completed {...props}/>);
        expect(wrapper.find('.completed-subtitle')).toHaveLength(1);
    });

    test('displays the no thanks option to close the onboarding list', () => {
        const wrapper = shallow(<Completed {...props}/>);
        const noThanksLink = wrapper.find('.no-thanks-link');
        expect(noThanksLink).toHaveLength(1);

        // calls the dissmiss function on click
        noThanksLink.simulate('click');
        expect(dismissMockFn).toHaveBeenCalledTimes(1);
    });
});
