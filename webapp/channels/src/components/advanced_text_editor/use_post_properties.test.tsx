// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';

import {patchPostPropertyValues} from 'mattermost-redux/actions/properties';

import {renderHookWithContext} from 'tests/react_testing_utils';

jest.mock('mattermost-redux/actions/properties', () => ({
    ...jest.requireActual('mattermost-redux/actions/properties'),
    patchPostPropertyValues: jest.fn(() => () => Promise.resolve({data: []})),
    loadChannelPostPropertyFields: jest.fn(() => () => Promise.resolve({data: []})),
}));

const mockPatch = patchPostPropertyValues as jest.MockedFunction<typeof patchPostPropertyValues>;

import usePostProperties from './use_post_properties';

describe('usePostProperties — onAfterSubmit', () => {
    beforeEach(() => {
        mockPatch.mockClear();
        mockPatch.mockReturnValue(() => Promise.resolve({data: []}));
    });

    test('does nothing when no items are staged', () => {
        const {result} = renderHookWithContext(
            () => usePostProperties('channel-1', '', false),
        );

        act(() => {
            result.current.onAfterSubmit({created: {id: 'real-post-1'}} as any);
        });

        expect(mockPatch).not.toHaveBeenCalled();
    });

    test('calls patchPostPropertyValues with the real post id and items that have values', () => {
        const {result} = renderHookWithContext(
            () => usePostProperties('channel-1', '', false),
        );

        act(() => {
            result.current.handleToggleStagedForTest('f1');
        });
        act(() => {
            result.current.handleChangeStagedValueForTest('f1', 'open');
        });
        act(() => {
            result.current.onAfterSubmit({created: {id: 'real-post-1'}} as any);
        });

        expect(mockPatch).toHaveBeenCalledWith(
            'real-post-1',
            [{field_id: 'f1', value: 'open'}],
        );
    });

    test('skips patching items with undefined value', () => {
        const {result} = renderHookWithContext(
            () => usePostProperties('channel-1', '', false),
        );

        act(() => {
            result.current.handleToggleStagedForTest('f1');
        });
        act(() => {
            result.current.onAfterSubmit({created: {id: 'real-post-1'}} as any);
        });

        expect(mockPatch).not.toHaveBeenCalled();
    });

    test('clears all staged items after submit', () => {
        mockPatch.mockReturnValue(() => Promise.resolve({data: []}));

        const {result} = renderHookWithContext(
            () => usePostProperties('channel-1', '', false),
        );

        act(() => {
            result.current.handleToggleStagedForTest('f1');
            result.current.handleChangeStagedValueForTest('f1', 'done');
        });

        expect(result.current.stagedItems).toHaveLength(1);

        act(() => {
            result.current.onAfterSubmit({created: {id: 'real-post-1'}} as any);
        });

        expect(result.current.stagedItems).toHaveLength(0);
    });

    test('does not patch when created is a boolean (scheduled post)', () => {
        const {result} = renderHookWithContext(
            () => usePostProperties('channel-1', '', false),
        );

        act(() => {
            result.current.handleToggleStagedForTest('f1');
            result.current.handleChangeStagedValueForTest('f1', 'val');
        });
        act(() => {
            result.current.onAfterSubmit({created: true} as any);
        });

        expect(mockPatch).not.toHaveBeenCalled();
    });
});
