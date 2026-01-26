// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AtPlanMention from './index';

describe('components/AtPlanMention', () => {
    it('should open pricing modal when plan mentioned is trial', async () => {
        const openPricingModal = jest.fn();
        jest.spyOn(useOpenPricingModal, 'default').mockImplementation(() => ({
            openPricingModal,
            isAirGapped: false,
        }));

        renderWithContext(<AtPlanMention plan='Enterprise trial'/>);
        await userEvent.click(screen.getByText('Enterprise trial'));

        expect(openPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should open pricing modal when plan mentioned is Enterprise', async () => {
        const openPricingModal = jest.fn();
        jest.spyOn(useOpenPricingModal, 'default').mockImplementation(() => ({
            openPricingModal,
            isAirGapped: false,
        }));

        renderWithContext(<AtPlanMention plan='Enterprise plan'/>);
        await userEvent.click(screen.getByText('Enterprise plan'));

        expect(openPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should open purchase modal when plan mentioned is professional', async () => {
        const openPricingModal = jest.fn();
        jest.spyOn(useOpenPricingModal, 'default').mockImplementation(() => ({
            openPricingModal,
            isAirGapped: false,
        }));

        renderWithContext(<AtPlanMention plan='Professional plan'/>);
        await userEvent.click(screen.getByText('Professional plan'));

        expect(openPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should render as span when air-gapped', () => {
        const openPricingModal = jest.fn();
        jest.spyOn(useOpenPricingModal, 'default').mockImplementation(() => ({
            openPricingModal,
            isAirGapped: true,
        }));

        renderWithContext(<AtPlanMention plan='Enterprise plan'/>);

        // When air-gapped, renders as span instead of anchor
        expect(screen.getByText('Enterprise plan').tagName).toBe('SPAN');
    });
});
