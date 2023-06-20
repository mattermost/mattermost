// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import ChipsList, {ChipsInfoType} from 'components/admin_console/workspace-optimization/chips_list';

import {ItemStatus} from './dashboard.type';

describe('components/admin_console/workspace-optimization/chips_list', () => {
    const overallScoreChips: ChipsInfoType = {
        [ItemStatus.INFO]: 3,
        [ItemStatus.WARNING]: 2,
        [ItemStatus.ERROR]: 1,
    };

    const baseProps = {
        chipsData: overallScoreChips,
        hideCountZeroChips: false,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<ChipsList {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('test chips list lenght is 3 as defined in baseProps', () => {
        const wrapper = shallow(<ChipsList {...baseProps}/>);
        const chips = wrapper.find('Chip');

        expect(chips.length).toBe(3);
    });

    test('test chips list lenght is 2 if one of the properties count is 0 and the hide zero count value is TRUE', () => {
        const zeroErrorProps = {
            chipsData: {...overallScoreChips, [ItemStatus.ERROR]: 0},
            hideCountZeroChips: true,
        };
        const wrapper = shallow(<ChipsList {...zeroErrorProps}/>);
        const chips = wrapper.find('Chip');

        expect(chips.length).toBe(2);
    });

    test('test chips list lenght is 3 even if one of the properties count is 0 BUT the hide zero count value is FALSE', () => {
        const zeroErrorProps = {
            chipsData: {...overallScoreChips, [ItemStatus.ERROR]: 0},
            hideCountZeroChips: false,
        };
        const wrapper = shallow(<ChipsList {...zeroErrorProps}/>);
        const chips = wrapper.find('Chip');

        expect(chips.length).toBe(3);
    });
});
