// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LearnMoreTrialModalStep from 'components/learn_more_trial_modal/learn_more_trial_modal_step';

import {renderWithContext} from 'tests/react_testing_utils';

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

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <LearnMoreTrialModalStep {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with optional params', () => {
        const {container} = renderWithContext(
            <LearnMoreTrialModalStep
                {...props}
                bottomLeftMessage='Step bottom message'
            />,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when loaded in cloud workspace', () => {
        const cloudProps = {...props, isCloud: true};
        const {container} = renderWithContext(
            <LearnMoreTrialModalStep
                {...cloudProps}
                bottomLeftMessage='Step bottom message'
            />,
            state,
        );

        expect(container).toMatchSnapshot();
    });
});
