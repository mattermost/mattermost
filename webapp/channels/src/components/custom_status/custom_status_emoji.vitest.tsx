// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as CustomStatusSelectors from 'selectors/views/custom_status';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import CustomStatusEmoji from './custom_status_emoji';

vi.mock('mattermost-redux/selectors/entities/timezone');
vi.mock('selectors/views/custom_status');

describe('components/custom_status/custom_status_emoji', () => {
    const getCustomStatus = () => {
        return null;
    };

    beforeEach(() => {
        (CustomStatusSelectors.makeGetCustomStatus as ReturnType<typeof vi.fn>).mockReturnValue(getCustomStatus);
        (CustomStatusSelectors.isCustomStatusEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (CustomStatusSelectors.isCustomStatusExpired as ReturnType<typeof vi.fn>).mockReturnValue(false);
    });

    it('should match snapshot', () => {
        const {container} = renderWithContext(<CustomStatusEmoji/>);
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot with props', () => {
        const {container} = renderWithContext(
            <CustomStatusEmoji
                emojiSize={34}
                showTooltip={true}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    it('should not render when EnableCustomStatus in config is false', () => {
        (CustomStatusSelectors.isCustomStatusEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
        const {container} = renderWithContext(<CustomStatusEmoji/>);

        // Component should render empty
        expect(container.firstChild).toBeNull();
    });

    it('should not render when custom status is expired', () => {
        (CustomStatusSelectors.isCustomStatusEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (CustomStatusSelectors.isCustomStatusExpired as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const {container} = renderWithContext(<CustomStatusEmoji/>);

        // Component should render empty
        expect(container.firstChild).toBeNull();
    });
});
