// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import {CustomStatusDuration} from '@mattermost/types/users';

import ExpiryMenu from './expiry_menu';

describe('components/custom_status/expiry_menu', () => {
    const baseProps = {
        duration: CustomStatusDuration.DONT_CLEAR,
        handleDurationChange: jest.fn(),
    };

    it('should match snapshot', () => {
        const wrapper = mountWithIntl(<ExpiryMenu {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot with different props', () => {
        baseProps.duration = CustomStatusDuration.DATE_AND_TIME;
        const wrapper = mountWithIntl(<ExpiryMenu {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
