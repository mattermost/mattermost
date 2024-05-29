// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import * as useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import AtPlanMention from './index';

describe('components/AtPlanMention', () => {
    it('should open pricing modal when plan mentioned is trial', () => {
        const openPricingModal = jest.fn();
        jest.spyOn(useOpenPricingModal, 'default').mockImplementation(() => openPricingModal);

        const wrapper = shallow(<AtPlanMention plan='Enterprise trial'/>);
        wrapper.find('a').simulate('click', {
            preventDefault: () => {
            },
        });

        expect(openPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should open pricing modal when plan mentioned is Enterprise', () => {
        const openPricingModal = jest.fn();
        jest.spyOn(useOpenPricingModal, 'default').mockImplementation(() => openPricingModal);

        const wrapper = shallow(<AtPlanMention plan='Enterprise plan'/>);
        wrapper.find('a').simulate('click', {
            preventDefault: () => {
            },
        });

        expect(openPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should open purchase modal when plan mentioned is professional', () => {
        const openPricingModal = jest.fn();
        jest.spyOn(useOpenPricingModal, 'default').mockImplementation(() => openPricingModal);

        const wrapper = shallow(<AtPlanMention plan='Professional plan'/>);
        wrapper.find('a').simulate('click', {
            preventDefault: () => {
            },
        });

        expect(openPricingModal).toHaveBeenCalledTimes(1);
    });
});
