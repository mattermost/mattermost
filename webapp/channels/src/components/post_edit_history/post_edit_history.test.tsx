// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, waitForElementToBeRemoved} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PostEditHistory from './post_edit_history';

// jsdom doesn't implement scrolling, so we need to manually define this
window.HTMLElement.prototype.scrollTo = jest.fn();

describe('components/post_edit_history', () => {
    const baseProps: ComponentProps<typeof PostEditHistory> = {
        channelDisplayName: 'channel_display_name',
        originalPost: TestHelper.getPostMock({
            id: 'post_id',
            message: 'post message',
        }),
        dispatch: jest.fn(),
    };
    const mock = jest.spyOn(Client4, 'getPostEditHistory');

    test('should match snapshot', async () => {
        const data = [
            TestHelper.getPostMock({
                id: 'post_id_1',
                message: 'post message version 1',
            }),
            TestHelper.getPostMock({
                id: 'post_id_2',
                message: 'post message version 2',
            }),
        ];
        mock.mockResolvedValue(data);

        const wrapper = renderWithContext(<PostEditHistory {...baseProps}/>);

        await waitForElementToBeRemoved(() => screen.queryByText('Loading'));

        expect(wrapper.container).toMatchSnapshot();
        expect(mock).toHaveBeenCalledWith(baseProps.originalPost.id);
    });

    test('should display error screen if errors are present', async () => {
        const error = new Error('An example error');
        mock.mockRejectedValue(error);

        const wrapper = renderWithContext(<PostEditHistory {...baseProps}/>);

        await waitForElementToBeRemoved(() => screen.queryByText('Loading'));

        expect(wrapper.container).toMatchSnapshot();
        expect(mock).toHaveBeenCalledWith(baseProps.originalPost.id);
    });
});
