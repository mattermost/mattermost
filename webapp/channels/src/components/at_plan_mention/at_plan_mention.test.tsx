// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import * as useOpenPricingDetails from 'components/common/hooks/useOpenPricingDetails';

import AtPlanMention from './index';

describe('components/AtPlanMention', () => {
    it('should open pricing details when plan mentioned is trial', () => {
        const openPricingDetails = jest.fn();
        jest.spyOn(useOpenPricingDetails, 'default').mockImplementation(() => openPricingDetails);

        const wrapper = shallow(<AtPlanMention plan='Enterprise trial'/>);
        wrapper.find('a').simulate('click', {
            preventDefault: () => {
            },
        });

        expect(openPricingDetails).toHaveBeenCalledTimes(1);
    });

    it('should open pricing details when plan mentioned is Enterprise', () => {
        const openPricingDetails = jest.fn();
        jest.spyOn(useOpenPricingDetails, 'default').mockImplementation(() => openPricingDetails);

        const wrapper = shallow(<AtPlanMention plan='Enterprise plan'/>);
        wrapper.find('a').simulate('click', {
            preventDefault: () => {
            },
        });

        expect(openPricingDetails).toHaveBeenCalledTimes(1);
    });

    it('should open pricing details when plan mentioned is professional', () => {
        const openPricingDetails = jest.fn();
        jest.spyOn(useOpenPricingDetails, 'default').mockImplementation(() => openPricingDetails);

        const wrapper = shallow(<AtPlanMention plan='Professional plan'/>);
        wrapper.find('a').simulate('click', {
            preventDefault: () => {
            },
        });

        expect(openPricingDetails).toHaveBeenCalledTimes(1);
    });
});
