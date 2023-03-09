// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {arePropsEqual} from 'components/search_results/search_results';

describe('components/SearchResults', () => {
    describe('shouldRenderFromProps', () => {
        const result1 = {test: 'test'};
        const result2 = {test: 'test'};
        const fileResult1 = {test: 'test'};
        const fileResult2 = {test: 'test'};
        const results = [result1, result2];
        const fileResults = [fileResult1, fileResult2];
        const props = {
            prop1: 'someprop',
            somearray: [1, 2, 3],
            results,
            fileResults,
        };

        // Using a lot of anys here since the function is only used by SearchResults so the parameters are bound to its props
        // But the tests are written using arbitrary props

        test('should not render', () => {
            expect(arePropsEqual(props as any, {...props} as any)).toBeTruthy();
            expect(arePropsEqual(props as any, {...props, results: [result1, result2]} as any)).toBeTruthy();
            expect(arePropsEqual(props as any, {...props, fileResults: [fileResult1, fileResult2]} as any)).toBeTruthy();
        });

        test('should render', () => {
            expect(!arePropsEqual(props as any, {...props, prop1: 'newprop'} as any)).toBeTruthy();
            expect(!arePropsEqual(props as any, {...props, results: [result2, result1]} as any)).toBeTruthy();
            expect(!arePropsEqual(props as any, {...props, results: [result1, result2, {test: 'test'}]} as any)).toBeTruthy();
            expect(!arePropsEqual(props as any, {...props, fileResults: [fileResult2, fileResult1]} as any)).toBeTruthy();
            expect(!arePropsEqual(props as any, {...props, fileResults: [fileResult1, fileResult2, {test: 'test'}]} as any)).toBeTruthy();
            expect(!arePropsEqual(props as any, {...props, somearray: [1, 2, 3]} as any)).toBeTruthy();
        });
    });
});
