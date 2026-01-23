// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import * as useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import AtPlanMention from './index';

describe('components/AtPlanMention', () => {
    it('should open pricing modal when plan mentioned is trial', () => {
        const openPricingModal = jest.fn();
        jest.spyOn(useOpenPricingModal, 'default').mockImplementation(() => ({
            openPricingModal,
            isAirGapped: false,
        }));

        const wrapper = shallow(<AtPlanMention plan='Enterprise trial'/>);
        wrapper.find('a').simulate('click', {
            preventDefault: () => {
            },
        });

        expect(openPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should open pricing modal when plan mentioned is Enterprise', () => {
        const openPricingModal = jest.fn();
        jest.spyOn(useOpenPricingModal, 'default').mockImplementation(() => ({
            openPricingModal,
            isAirGapped: false,
        }));

        const wrapper = shallow(<AtPlanMention plan='Enterprise plan'/>);
        wrapper.find('a').simulate('click', {
            preventDefault: () => {
            },
        });

        expect(openPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should open purchase modal when plan mentioned is professional', () => {
        const openPricingModal = jest.fn();
        jest.spyOn(useOpenPricingModal, 'default').mockImplementation(() => ({
            openPricingModal,
            isAirGapped: false,
        }));

        const wrapper = shallow(<AtPlanMention plan='Professional plan'/>);
        wrapper.find('a').simulate('click', {
            preventDefault: () => {
            },
        });

        expect(openPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should render as span when air-gapped', () => {
        const openPricingModal = jest.fn();
        jest.spyOn(useOpenPricingModal, 'default').mockImplementation(() => ({
            openPricingModal,
            isAirGapped: true,
        }));

        const wrapper = shallow(<AtPlanMention plan='Enterprise plan'/>);
        expect(wrapper.find('span').exists()).toBe(true);
        expect(wrapper.find('a').exists()).toBe(false);
        expect(wrapper.find('span').text()).toBe('Enterprise plan');
    });
});
