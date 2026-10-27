// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHookWithContext} from 'tests/react_testing_utils';

import {useComboboxLabels} from './combobox_labels';

describe('useComboboxLabels', () => {
    test('returns the five labels with the field name interpolated', () => {
        const {result} = renderHookWithContext(() => useComboboxLabels('Department'));

        expect(result.current).toEqual({
            listboxLabel: 'Options',
            clearLabel: 'Clear Department',
            selectionsLabel: 'Department selections',
            emptyMessage: 'No results',
            loadingMessage: 'Loading…',
        });
    });

    test('inserts the field name literally, without parsing it as a message', () => {
        const {result} = renderHookWithContext(() => useComboboxLabels('R&D {team} <b>'));

        expect(result.current.clearLabel).toBe('Clear R&D {team} <b>');
        expect(result.current.selectionsLabel).toBe('R&D {team} <b> selections');
    });

    test('keeps the same object across rerenders while the field name is unchanged', () => {
        const {result, rerender} = renderHookWithContext(() => useComboboxLabels('Department'));
        const first = result.current;

        rerender();
        rerender();

        expect(result.current).toBe(first);
    });

    test('returns new labels when the field name changes', () => {
        let fieldLabel = 'Department';
        const {result, rerender} = renderHookWithContext(() => useComboboxLabels(fieldLabel));
        const first = result.current;

        fieldLabel = 'Location';
        rerender();

        expect(result.current).not.toBe(first);
        expect(result.current.clearLabel).toBe('Clear Location');
        expect(result.current.selectionsLabel).toBe('Location selections');
    });
});
