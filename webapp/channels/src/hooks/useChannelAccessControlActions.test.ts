// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getAccessControlFields,
    getVisualAST,
    searchUsersForExpression,
} from 'mattermost-redux/actions/access_control';

// Mock the redux actions
jest.mock('mattermost-redux/actions/access_control', () => ({
    getAccessControlFields: jest.fn(),
    getVisualAST: jest.fn(),
    searchUsersForExpression: jest.fn(),
}));

// Mock useDispatch
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
    useDispatch: () => mockDispatch,
}));

const mockGetAccessControlFields = getAccessControlFields as jest.MockedFunction<typeof getAccessControlFields>;
const mockGetVisualAST = getVisualAST as jest.MockedFunction<typeof getVisualAST>;
const mockSearchUsersForExpression = searchUsersForExpression as jest.MockedFunction<typeof searchUsersForExpression>;

describe('useChannelAccessControlActions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should have correct action imports', () => {
        // Test that the required actions are imported and mocked correctly
        expect(getAccessControlFields).toBeDefined();
        expect(getVisualAST).toBeDefined();
        expect(searchUsersForExpression).toBeDefined();
    });

    test('should mock action creators', () => {
        // Test that action creators are mocked correctly
        const mockAction = jest.fn();
        mockGetAccessControlFields.mockReturnValue(mockAction);

        const result = getAccessControlFields('after-id', 50);

        expect(mockGetAccessControlFields).toHaveBeenCalledWith('after-id', 50);
        expect(result).toBe(mockAction);
    });

    test('should mock getVisualAST action creator', () => {
        const mockAction = jest.fn();
        mockGetVisualAST.mockReturnValue(mockAction);

        const result = getVisualAST('user.attributes.department == "Engineering"');

        expect(mockGetVisualAST).toHaveBeenCalledWith('user.attributes.department == "Engineering"');
        expect(result).toBe(mockAction);
    });

    test('should mock searchUsersForExpression action creator', () => {
        const mockAction = jest.fn();
        mockSearchUsersForExpression.mockReturnValue(mockAction);

        const result = searchUsersForExpression('expression', 'john', 'after-id', 25);

        expect(mockSearchUsersForExpression).toHaveBeenCalledWith('expression', 'john', 'after-id', 25);
        expect(result).toBe(mockAction);
    });
});
