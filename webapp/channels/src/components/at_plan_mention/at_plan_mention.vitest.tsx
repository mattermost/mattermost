// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import {renderWithContext, userEvent} from 'tests/vitest_react_testing_utils';

import AtPlanMention from './index';

describe('components/AtPlanMention', () => {
    it('should open pricing modal when plan mentioned is trial', async () => {
        const openPricingModal = vi.fn();
        vi.spyOn(useOpenPricingModal, 'default').mockImplementation(() => ({
            openPricingModal,
            isAirGapped: false,
        }));

        const {container} = renderWithContext(<AtPlanMention plan='Enterprise trial'/>);
        const link = container.querySelector('#at_plan_mention');
        expect(link).toBeTruthy();
        await userEvent.click(link!);

        expect(openPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should open pricing modal when plan mentioned is Enterprise', async () => {
        const openPricingModal = vi.fn();
        vi.spyOn(useOpenPricingModal, 'default').mockImplementation(() => ({
            openPricingModal,
            isAirGapped: false,
        }));

        const {container} = renderWithContext(<AtPlanMention plan='Enterprise plan'/>);
        const link = container.querySelector('#at_plan_mention');
        expect(link).toBeTruthy();
        await userEvent.click(link!);

        expect(openPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should open purchase modal when plan mentioned is professional', async () => {
        const openPricingModal = vi.fn();
        vi.spyOn(useOpenPricingModal, 'default').mockImplementation(() => ({
            openPricingModal,
            isAirGapped: false,
        }));

        const {container} = renderWithContext(<AtPlanMention plan='Professional plan'/>);
        const link = container.querySelector('#at_plan_mention');
        expect(link).toBeTruthy();
        await userEvent.click(link!);

        expect(openPricingModal).toHaveBeenCalledTimes(1);
    });

    it('should render as span when air-gapped', () => {
        const openPricingModal = vi.fn();
        vi.spyOn(useOpenPricingModal, 'default').mockImplementation(() => ({
            openPricingModal,
            isAirGapped: true,
        }));

        const {container} = renderWithContext(<AtPlanMention plan='Enterprise plan'/>);
        const span = container.querySelector('span#at_plan_mention');
        const link = container.querySelector('a#at_plan_mention');

        expect(span).toBeInTheDocument();
        expect(link).not.toBeInTheDocument();
        expect(span?.textContent).toBe('Enterprise plan');
    });
});
