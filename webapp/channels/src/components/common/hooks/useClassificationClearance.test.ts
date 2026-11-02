// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';

import {Client4} from 'mattermost-redux/client';

import {renderHookWithContext} from 'tests/react_testing_utils';

import useClassificationClearance from './useClassificationClearance';

jest.mock('mattermost-redux/client', () => ({
    Client4: {getPropertyFields: jest.fn()},
}));

const abacEnabledState = {
    entities: {general: {config: {EnableAttributeBasedAccessControl: 'true'}}},
};

describe('useClassificationClearance', () => {
    const getPropertyFields = Client4.getPropertyFields as jest.Mock;

    beforeEach(() => {
        getPropertyFields.mockReset();
    });

    it('does not look anything up without a template id', () => {
        const {result} = renderHookWithContext(() => useClassificationClearance(undefined), abacEnabledState);

        expect(getPropertyFields).not.toHaveBeenCalled();
        expect(result.current).toEqual({clearanceEnabled: false, isResolving: false});
    });

    it('stays resolving until the lookup settles, then reports no clearance', async () => {
        let resolveFetch: (fields: unknown[]) => void = () => {};
        getPropertyFields.mockImplementationOnce(() => new Promise((resolve) => {
            resolveFetch = resolve;
        })).mockResolvedValue([]);

        const {result} = renderHookWithContext(() => useClassificationClearance('template1'), abacEnabledState);
        expect(result.current).toEqual({clearanceEnabled: false, isResolving: true});

        await act(async () => {
            resolveFetch([]);
        });

        expect(result.current).toEqual({clearanceEnabled: false, isResolving: false});
    });

    it('resolves to not resolving when the lookup fails', async () => {
        getPropertyFields.mockRejectedValue(new Error('boom'));

        const {result} = renderHookWithContext(() => useClassificationClearance('template1'), abacEnabledState);

        await act(async () => {});

        expect(result.current).toEqual({clearanceEnabled: false, isResolving: false});
    });

    it('goes back to resolving when a new lookup starts after the check was disabled', async () => {
        getPropertyFields.mockResolvedValueOnce([]).mockReturnValue(new Promise(() => {}));

        let templateId: string | undefined;
        const {result, rerender} = renderHookWithContext(() => useClassificationClearance(templateId), abacEnabledState);

        templateId = 'template1';
        rerender();
        await act(async () => {});
        expect(result.current.isResolving).toBe(false);

        templateId = undefined;
        rerender();
        expect(result.current.isResolving).toBe(false);

        templateId = 'template1';
        rerender();
        expect(result.current.isResolving).toBe(true);
    });
});
