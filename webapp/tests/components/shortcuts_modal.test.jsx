// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper.jsx';
import ShortcutsModal from 'components/shortcuts_modal.jsx';

describe('components/ShortcutsModal', () => {
    test('should match snapshot modal for Mac', () => {
        const wrapper = mountWithIntl(
            <ShortcutsModal isMac={true}/>
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot modal for non-Mac like Windows/Linux', () => {
        const wrapper = mountWithIntl(
            <ShortcutsModal isMac={false}/>
        );

        expect(wrapper).toMatchSnapshot();
    });
});
