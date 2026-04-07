// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {CustomStatusDuration} from '@mattermost/types/users';

import {renderWithContext} from 'tests/react_testing_utils';

import ExpiryMenu from './expiry_menu';

describe('components/custom_status/expiry_menu', () => {
    const baseProps = {
        duration: CustomStatusDuration.DONT_CLEAR,
        handleDurationChange: jest.fn(),
    };

    it('should match snapshot', async () => {
        const {container} = await renderWithContext(<ExpiryMenu {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot with different props', async () => {
        baseProps.duration = CustomStatusDuration.DATE_AND_TIME;
        const {container} = await renderWithContext(<ExpiryMenu {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });
});
