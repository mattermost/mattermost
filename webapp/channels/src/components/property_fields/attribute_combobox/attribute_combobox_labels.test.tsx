// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderHookWithContext} from 'tests/react_testing_utils';

import {getAttributeComboboxLabels, useAttributeComboboxLabels} from './attribute_combobox_labels';

const translatedMessages = {
    'property_fields.attribute_combobox.listbox': 'Opciones',
    'property_fields.attribute_combobox.clear': 'Borrar {label}',
    'property_fields.attribute_combobox.selections': 'Selecciones de {label}',
    'property_fields.attribute_combobox.empty': 'Sin resultados',
    'property_fields.attribute_combobox.loading': 'Cargando…',
};

describe('getAttributeComboboxLabels', () => {
    test('returns the five labels with the field name interpolated', () => {
        expect(getAttributeComboboxLabels(defaultIntl, 'Department')).toEqual({
            listboxLabel: 'Options',
            clearLabel: 'Clear Department',
            selectionsLabel: 'Department selections',
            emptyMessage: 'No results',
            loadingMessage: 'Loading…',
        });
    });

    test('inserts the field name literally, without parsing it as a message', () => {
        const labels = getAttributeComboboxLabels(defaultIntl, 'R&D {team} <b>');

        expect(labels.clearLabel).toBe('Clear R&D {team} <b>');
        expect(labels.selectionsLabel).toBe('R&D {team} <b> selections');
    });

    test('uses the translated messages for the active locale', () => {
        const intl = createIntl({locale: 'es', defaultLocale: 'en', messages: translatedMessages});

        expect(getAttributeComboboxLabels(intl, 'Departamento')).toEqual({
            listboxLabel: 'Opciones',
            clearLabel: 'Borrar Departamento',
            selectionsLabel: 'Selecciones de Departamento',
            emptyMessage: 'Sin resultados',
            loadingMessage: 'Cargando…',
        });
    });
});

describe('useAttributeComboboxLabels', () => {
    test('returns the same labels as getAttributeComboboxLabels', () => {
        const {result} = renderHookWithContext(() => useAttributeComboboxLabels('Department'));

        expect(result.current).toEqual(getAttributeComboboxLabels(defaultIntl, 'Department'));
    });

    test('keeps the same object across rerenders while the field name is unchanged', () => {
        const {result, rerender} = renderHookWithContext(() => useAttributeComboboxLabels('Department'));
        const first = result.current;

        rerender();
        rerender();

        expect(result.current).toBe(first);
    });

    test('returns new labels when the field name changes', () => {
        let fieldLabel = 'Department';
        const {result, rerender} = renderHookWithContext(() => useAttributeComboboxLabels(fieldLabel));
        const first = result.current;

        fieldLabel = 'Location';
        rerender();

        expect(result.current).not.toBe(first);
        expect(result.current.clearLabel).toBe('Clear Location');
        expect(result.current.selectionsLabel).toBe('Location selections');
    });
});
