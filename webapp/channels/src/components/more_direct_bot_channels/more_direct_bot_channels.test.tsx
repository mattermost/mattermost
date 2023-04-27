// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {GlobalState} from '@mattermost/types/store';

import {ModalIdentifiers} from 'utils/constants';

import MoreDirectBotChannelsModal from './';

const mockDispatch = jest.fn();
let mockState: GlobalState;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/more_direct_bot_channels', () => {
    mockState = {
        views: {
            modals: {
                modalState: {
                    [ModalIdentifiers.MORE_DIRECT_BOT_CHANNELS]: {
                        open: true,
                    },
                },
            },
        },
    } as unknown as GlobalState;

    test('should match snapshot', () => {
        expect(
            shallow(
                <MoreDirectBotChannelsModal/>,
            ),
        ).toMatchSnapshot();
    });
});
