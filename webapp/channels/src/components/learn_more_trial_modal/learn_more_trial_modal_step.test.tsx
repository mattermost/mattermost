// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';

import LearnMoreTrialModalStep from 'components/learn_more_trial_modal/learn_more_trial_modal_step';

import mockStore from 'tests/test_store';

describe('components/learn_more_trial_modal/learn_more_trial_modal_step', () => {
    const props = {
        id: 'stepId',
        title: 'Step title',
        description: 'Step description',
        svgWrapperClassName: 'stepClassname',
        svgElement: <svg/>,
        buttonLabel: 'button',
    };

    const state = {
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

    const store = mockStore(state);

    test('should match snapshot', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <LearnMoreTrialModalStep {...props}/>
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with optional params', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <LearnMoreTrialModalStep
                    {...props}
                    bottomLeftMessage='Step bottom message'
                />
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when loaded in cloud workspace', () => {
        const cloudProps = {...props, isCloud: true};
        const wrapper = shallow(
            <Provider store={store}>
                <LearnMoreTrialModalStep
                    {...cloudProps}
                    bottomLeftMessage='Step bottom message'
                />
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
