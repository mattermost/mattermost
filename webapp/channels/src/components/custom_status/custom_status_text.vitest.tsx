// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as CustomStatusSelectors from 'selectors/views/custom_status';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import CustomStatusText from './custom_status_text';

vi.mock('selectors/views/custom_status');

describe('components/custom_status/custom_status_text', () => {
    beforeEach(() => {
        (CustomStatusSelectors.isCustomStatusEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    });

    it('should match snapshot', () => {
        const {container} = renderWithContext(<CustomStatusText/>);

        expect(container).toMatchSnapshot();
    });

    it('should match snapshot with props', () => {
        const {container} = renderWithContext(
            <CustomStatusText
                text='In a meeting'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    it('should not render when EnableCustomStatus in config is false', () => {
        (CustomStatusSelectors.isCustomStatusEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
        const {container} = renderWithContext(<CustomStatusText/>);

        // Component should render empty
        expect(container.firstChild).toBeNull();
    });
});
