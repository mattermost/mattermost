// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {ShortcutKey, ShortcutKeyVariant} from './shortcut_key';

describe('components/ShortcutKey', () => {
    test('should match snapshot for regular key', () => {
        const wrapper = shallow(<ShortcutKey>{'Shift'}</ShortcutKey>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for contrast key', () => {
        const wrapper = shallow(<ShortcutKey variant={ShortcutKeyVariant.Contrast}>{'Shift'}</ShortcutKey>);
        expect(wrapper).toMatchSnapshot();
    });
});
