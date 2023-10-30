// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

import LoadingSpinner from './loading_spinner';

describe('components/widgets/loadingLoadingSpinner', () => {
    test('showing spinner with text', () => {
        const wrapper = shallowWithIntl(<LoadingSpinner text='test'/>);
        expect(wrapper).toMatchSnapshot();
    });
    test('showing spinner without text', () => {
        const wrapper = shallowWithIntl(<LoadingSpinner/>);
        expect(wrapper).toMatchSnapshot();
    });
});
