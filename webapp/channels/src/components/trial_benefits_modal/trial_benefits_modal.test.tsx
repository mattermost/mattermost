// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import Carousel from 'components/common/carousel/carousel';
import TrialBenefitsModal from 'components/trial_benefits_modal/trial_benefits_modal';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {TELEMETRY_CATEGORIES} from 'utils/constants';

const mockLocation = {pathname: '', search: '', hash: ''};

jest.mock('actions/telemetry_actions.jsx', () => {
    const original = jest.requireActual('actions/telemetry_actions.jsx');
    return {
        ...original,
        trackEvent: jest.fn(),
    };
});

jest.mock('components/admin_console/blockable_link', () => {
    return () => {
        return <div/>;
    };
});

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom') as typeof import('react-router-dom'),
    useLocation: () => mockLocation,
}));

describe('components/trial_benefits_modal/trial_benefits_modal', () => {
    // required state to mount using the provider
    const state = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'false',
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    trial_benefits_modal: {
                        open: true,
                    },
                },
            },
            admin: {
                navigationBlock: {
                    blocked: true,
                },
            },
        },
    };

    const props = {
        onExited: jest.fn(),
        trialJustStarted: false,
    };

    const store = mockStore(state);

    test('should match snapshot', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <TrialBenefitsModal {...props}/>
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when trial has already started', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <TrialBenefitsModal
                    {...props}
                    trialJustStarted={true}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should show the benefits modal', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TrialBenefitsModal {...props}/>
            </Provider>,
        );
        expect(wrapper.find('TrialBenefitsModal').find('Carousel')).toHaveLength(1);
    });

    test('should hide the benefits modal', () => {
        const trialBenefitsModalHidden = {
            modals: {
                modalState: {},
            },
        };
        const localStore = {...state, views: trialBenefitsModalHidden};
        const store = mockStore(localStore);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TrialBenefitsModal {...props}/>
            </Provider>,
        );
        expect(wrapper.find('TrialBenefitsModal').find('Carousel')).toHaveLength(0);
    });

    test('should call on close', () => {
        const mockOnClose = jest.fn();

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TrialBenefitsModal
                    {...props}
                    onClose={mockOnClose}
                    trialJustStarted={true}
                />
            </Provider>,
        );

        wrapper.find(GenericModal).props().onExited();

        expect(mockOnClose).toHaveBeenCalled();
    });

    test('should call on exited', () => {
        const mockOnExited = jest.fn();

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TrialBenefitsModal
                    {...props}
                    onExited={mockOnExited}
                />
            </Provider>,
        );

        wrapper.find(GenericModal).props().onExited();

        expect(mockOnExited).toHaveBeenCalled();
    });

    test('should handle slide prev next click', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TrialBenefitsModal
                    {...props}
                />
            </Provider>,
        );

        wrapper.find(Carousel).props().onNextSlideClick!(5);

        expect(trackEvent).toHaveBeenCalledWith(
            TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_MODAL,
            'benefits_modal_post_enterprise_view',
        );

        wrapper.find(Carousel).props().onNextSlideClick!(4);

        expect(trackEvent).toHaveBeenCalledWith(
            TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_MODAL,
            'benefits_modal_slide_shown_playbooks',
        );

        wrapper.find(Carousel).props().onPrevSlideClick!(2);

        expect(trackEvent).toHaveBeenCalledWith(
            TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_MODAL,
            'benefits_modal_slide_shown_ldap',
        );
    });

    test('should present the just started trial modal content', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TrialBenefitsModal
                    {...props}
                    trialJustStarted={true}
                />
            </Provider>,
        );

        const title = wrapper.find('#trialBenefitsModalStarted-trialStart div.title').text();

        expect(title).toBe('Your trial has started! Explore the benefits of Enterprise');
    });

    test('should have a shorter title and not include the cta button when in cloud env', () => {
        const cloudState = {...state, entities: {...state.entities, general: {...state.entities.general, license: {Cloud: 'true'}}}};
        const cloudStore = mockStore(cloudState);
        const wrapper = mountWithIntl(
            <Provider store={cloudStore}>
                <TrialBenefitsModal
                    {...props}
                    trialJustStarted={true}
                />
            </Provider>,
        );

        const title = wrapper.find('#trialBenefitsModalStarted-trialStart div.title').text();
        expect(title).toBe('Your trial has started!');

        const ctaBtn = wrapper.find('#trialBenefitsModalStarted-trialStart button.btn-primary');
        expect(ctaBtn).toHaveLength(0);
    });

    test('should show the invite people call to action when trial started from the team', () => {
        const cloudState = {...state, entities: {...state.entities, general: {...state.entities.general, license: {Cloud: 'true'}}}};
        const cloudStore = mockStore(cloudState);
        const wrapper = mountWithIntl(
            <Provider store={cloudStore}>
                <TrialBenefitsModal
                    {...props}
                    trialJustStarted={true}
                />
            </Provider>,
        );

        const title = wrapper.find('#trialBenefitsModalStarted-trialStart div.title').text();
        expect(title).toBe('Your trial has started!');

        const ctaBtn = wrapper.find('.buttons-section-wrapper a span');
        expect(ctaBtn.text()).toBe('Invite people');
    });

    test('should show hide the invite people call to action when trial started from system console', () => {
        const cloudState = {...state, entities: {...state.entities, general: {...state.entities.general, license: {Cloud: 'true'}}}};
        const cloudStore = mockStore(cloudState);

        mockLocation.pathname = '/admin_console';
        const wrapper = mountWithIntl(
            <Provider store={cloudStore}>
                <TrialBenefitsModal
                    {...props}
                    trialJustStarted={true}
                />
            </Provider>,
        );

        const title = wrapper.find('#trialBenefitsModalStarted-trialStart div.title').text();
        expect(title).toBe('Your trial has started!');

        const ctaBtn = wrapper.find('.buttons-section-wrapper a span');
        expect(ctaBtn.text()).toBe('Close');
    });
});
