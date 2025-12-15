// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import * as ReactRedux from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {renderWithContext, screen, waitForElementToBeRemoved} from 'tests/react_testing_utils';
import {isPopoutWindow, popoutPostEditHistory} from 'utils/popouts/popout_windows';
import {TestHelper} from 'utils/test_helper';

import PostEditHistory from './post_edit_history';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: jest.fn(),
}));

jest.mock('utils/popouts/popout_windows', () => ({
    isPopoutWindow: jest.fn(),
    popoutPostEditHistory: jest.fn(),
    canPopout: jest.fn(() => true),
}));

jest.mock('components/popout_button', () => ({
    __esModule: true,
    default: ({onClick}: {onClick: () => void}) => (
        <button
            data-testid='popout-button'
            onClick={onClick}
            aria-label='Open in new window'
        >
            {'PopoutButton'}
        </button>
    ),
}));

// jsdom doesn't implement scrolling, so we need to manually define this
window.HTMLElement.prototype.scrollTo = jest.fn();

const mockIsPopoutWindow = isPopoutWindow as jest.MockedFunction<typeof isPopoutWindow>;
const mockPopoutPostEditHistory = popoutPostEditHistory as jest.MockedFunction<typeof popoutPostEditHistory>;
const mockUseSelector = ReactRedux.useSelector as jest.MockedFunction<typeof ReactRedux.useSelector>;

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

    const mockTeam = TestHelper.getTeamMock({id: 'team_id', name: 'team_name'});
    const mockChannel = TestHelper.getChannelMock({id: 'channel_id', name: 'channel_name'});

    beforeEach(() => {
        jest.clearAllMocks();
        mockIsPopoutWindow.mockReturnValue(false);
        mockUseSelector.mockImplementation((selector) => {
            if (selector === getCurrentTeam) {
                return mockTeam;
            }
            if (selector === getCurrentChannel) {
                return mockChannel;
            }
            return undefined;
        });
    });

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

    test('should not show popout button when in popout window', async () => {
        mockIsPopoutWindow.mockReturnValue(true);
        const data = [
            TestHelper.getPostMock({
                id: 'post_id_1',
                message: 'post message version 1',
            }),
        ];
        mock.mockResolvedValue(data);

        renderWithContext(<PostEditHistory {...baseProps}/>);

        await waitForElementToBeRemoved(() => screen.queryByText('Loading'));

        expect(screen.queryByTestId('popout-button')).not.toBeInTheDocument();
    });

    test('should call popoutPostEditHistory when popout button is clicked', async () => {
        mockIsPopoutWindow.mockReturnValue(false);
        mockUseSelector.mockImplementation((selector) => {
            if (selector === getCurrentTeam) {
                return mockTeam;
            }
            if (selector === getCurrentChannel) {
                return mockChannel;
            }
            return undefined;
        });
        const data = [
            TestHelper.getPostMock({
                id: 'post_id_1',
                message: 'post message version 1',
            }),
        ];
        mock.mockResolvedValue(data);

        renderWithContext(<PostEditHistory {...baseProps}/>);

        await waitForElementToBeRemoved(() => screen.queryByText('Loading'));

        const popoutButton = screen.getByTestId('popout-button');
        popoutButton.click();

        expect(mockPopoutPostEditHistory).toHaveBeenCalledTimes(1);
        expect(mockPopoutPostEditHistory).toHaveBeenCalledWith(
            expect.objectContaining({
                formatMessage: expect.any(Function),
            }),
            baseProps.originalPost.id,
            mockTeam.name,
            mockChannel.name,
        );
    });
});
