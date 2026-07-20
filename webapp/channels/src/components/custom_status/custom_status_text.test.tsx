// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as CustomStatusSelectors from 'selectors/views/custom_status';

import {renderWithContext} from 'tests/react_testing_utils';

import CustomStatusText from './custom_status_text';

jest.mock('selectors/views/custom_status');

describe('components/custom_status/custom_status_text', () => {
    beforeEach(() => {
        (CustomStatusSelectors.isCustomStatusEnabled as any as jest.Mock).mockReturnValue(true);
    });

    it('should match snapshot', () => {
        const {container} = renderWithContext(<CustomStatusText text='Available'/>);

        expect(container).toMatchSnapshot();
    });

    it('should match snapshot with props', () => {
        const {container} = renderWithContext(
            <CustomStatusText
                text='In a meeting'
                className='custom-class'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    it('should not render when EnableCustomStatus in config is false', () => {
        (CustomStatusSelectors.isCustomStatusEnabled as any as jest.Mock).mockReturnValue(false);
        const {container} = renderWithContext(<CustomStatusText/>);

        expect(container).toBeEmptyDOMElement();
    });
});
