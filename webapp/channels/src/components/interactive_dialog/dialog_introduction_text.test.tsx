// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import DialogIntroductionText from './dialog_introduction_text';

describe('components/DialogIntroductionText', () => {
    test('should render message with supported values', () => {
        const descriptor = {
            value: '**bold** *italic* [link](https://mattermost.com/) <br/> [link target blank](!https://mattermost.com/)',
        };
        const wrapper = renderWithContext(<DialogIntroductionText {...descriptor}/>);
        expect(wrapper.asFragment()).toMatchSnapshot();
    });

    test('should not fail on empty value', () => {
        const descriptor = {
            value: '',
        };
        const wrapper = renderWithContext(<DialogIntroductionText {...descriptor}/>);
        expect(wrapper.asFragment()).toMatchSnapshot();
    });
});
