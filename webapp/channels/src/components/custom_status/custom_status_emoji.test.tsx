// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as CustomStatusSelectors from 'selectors/views/custom_status';

import {renderWithContext} from 'tests/react_testing_utils';

import CustomStatusEmoji from './custom_status_emoji';

jest.mock('mattermost-redux/selectors/entities/timezone');
jest.mock('selectors/views/custom_status');

describe('components/custom_status/custom_status_emoji', () => {
    const customStatus = {
        emoji: 'smile',
        text: 'Happy',
    };

    beforeEach(() => {
        (CustomStatusSelectors.makeGetCustomStatus as jest.Mock).mockReturnValue(() => customStatus);
        (CustomStatusSelectors.isCustomStatusEnabled as any as jest.Mock).mockReturnValue(true);
        (CustomStatusSelectors.isCustomStatusExpired as jest.Mock).mockReturnValue(false);
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
        (CustomStatusSelectors.isCustomStatusEnabled as any as jest.Mock).mockReturnValue(false);
        const {container} = renderWithContext(<CustomStatusEmoji/>);

        expect(container).toBeEmptyDOMElement();
    });

    it('should not render when custom status is expired', () => {
        (CustomStatusSelectors.isCustomStatusEnabled as any as jest.Mock).mockReturnValue(true);
        (CustomStatusSelectors.isCustomStatusExpired as jest.Mock).mockReturnValue(true);
        const {container} = renderWithContext(<CustomStatusEmoji/>);

        expect(container).toBeEmptyDOMElement();
    });
});
