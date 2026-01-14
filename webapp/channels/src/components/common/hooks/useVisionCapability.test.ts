// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as ReactRedux from 'react-redux';

import {renderHookWithContext} from 'tests/react_testing_utils';

import useVisionCapability from './useVisionCapability';

describe('useVisionCapability', () => {
    const dispatchMock = jest.fn();

    beforeAll(() => {
        jest.spyOn(ReactRedux, 'useDispatch').mockImplementation(() => dispatchMock);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('should return false when no agents are available', () => {
        const {result} = renderHookWithContext(
            () => useVisionCapability(),
            {
                entities: {
                    agents: {
                        agents: [],
                    },
                },
            },
        );

        expect(result.current).toBe(false);
    });

    it('should return true when agents are available', () => {
        const {result} = renderHookWithContext(
            () => useVisionCapability(),
            {
                entities: {
                    agents: {
                        agents: [{id: 'agent1', displayName: 'Test Agent'}],
                    },
                },
            },
        );

        expect(result.current).toBe(true);
    });
});
