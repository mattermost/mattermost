// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import AtPlanMention from './index';

// Mock the hook
jest.mock('components/common/hooks/useOpenPricingModal', () => ({
    __esModule: true,
    default: jest.fn(),
}));

import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
const mockUseOpenPricingModal = useOpenPricingModal as jest.MockedFunction<typeof useOpenPricingModal>;

describe('components/AtPlanMention', () => {
    const mockOpenPricingModal = jest.fn();

    beforeEach(() => {
        mockOpenPricingModal.mockClear();
        mockUseOpenPricingModal.mockReturnValue({
            openPricingModal: mockOpenPricingModal,
            isAirGapped: false,
        });
    });

    it('should open pricing modal when plan mentioned is trial', () => {
        const wrapper = shallow(<AtPlanMention plan='Enterprise trial'/>);
        wrapper.find('a').simulate('click', {
            preventDefault: () => {
            },
        });

        expect(mockOpenPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should open pricing modal when plan mentioned is Enterprise', () => {
        const wrapper = shallow(<AtPlanMention plan='Enterprise plan'/>);
        wrapper.find('a').simulate('click', {
            preventDefault: () => {
            },
        });

        expect(mockOpenPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should open purchase modal when plan mentioned is professional', () => {
        const wrapper = shallow(<AtPlanMention plan='Professional plan'/>);
        wrapper.find('a').simulate('click', {
            preventDefault: () => {
            },
        });

        expect(mockOpenPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should render as span when air-gapped', () => {
        mockUseOpenPricingModal.mockReturnValue({
            openPricingModal: mockOpenPricingModal,
            isAirGapped: true,
        });

        const wrapper = shallow(<AtPlanMention plan='Enterprise plan'/>);
        expect(wrapper.find('span').exists()).toBe(true);
        expect(wrapper.find('a').exists()).toBe(false);
        expect(wrapper.find('span').text()).toBe('Enterprise plan');
    });
});
