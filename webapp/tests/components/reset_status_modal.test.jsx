// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import ResetStatusModal from 'components/reset_status_modal/reset_status_modal.jsx';

describe('components/ResetStatusModal', () => {
    test('should match snapshot', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        async function fakeAutoReset() { //eslint-disable-line require-await
            return {status: 'away', manual: true, user_id: 'fake'};
        }

        const wrapper = shallow(
            <ResetStatusModal
                autoResetPref=''
                actions={{
                    autoResetStatus: fakeAutoReset,
                    setStatus: emptyFunction,
                    savePreferences: emptyFunction
                }}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });
});
