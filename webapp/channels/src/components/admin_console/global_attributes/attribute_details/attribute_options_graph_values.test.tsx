// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AttributeOptionsGraphValues from './attribute_options_graph_values';

describe('AttributeOptionsGraphValues', () => {
    const renderEmpty = (onOptionsChange = jest.fn()) =>
        renderWithContext(
            <AttributeOptionsGraphValues
                options={[]}
                onOptionsChange={onOptionsChange}
            />,
        );

    it('renders helper, empty canvas, footer, and a disabled Add value', () => {
        renderEmpty();

        expect(screen.getByTestId('attributeOptionsGraphEmpty')).toBeInTheDocument();
        expect(screen.getByText('Each value can have parents and children.')).toBeInTheDocument();
        expect(screen.getByText('Add the first value')).toBeInTheDocument();
        expect(screen.getByText('Start with a top-level value. You can add parents and children from its row.')).toBeInTheDocument();
        expect(screen.getByText('Up to 100 parents per value, 100 levels deep.')).toBeInTheDocument();
        expect(screen.getByTestId('attributeOptionsGraphEmpty__addButton')).toBeDisabled();
        expect(screen.queryByTestId('attributeOptionsGraphList')).not.toBeInTheDocument();
    });

    it('does not enable Add value on whitespace', async () => {
        const onOptionsChange = jest.fn();
        renderEmpty(onOptionsChange);

        await userEvent.type(screen.getByTestId('attributeOptionsGraphEmpty__nameInput'), '   ');

        expect(screen.getByTestId('attributeOptionsGraphEmpty__addButton')).toBeDisabled();
        expect(onOptionsChange).not.toHaveBeenCalled();
    });

    it('enables Add value once a trimmed name is present and commits parents: []', async () => {
        const onOptionsChange = jest.fn();
        renderEmpty(onOptionsChange);

        await userEvent.type(screen.getByTestId('attributeOptionsGraphEmpty__nameInput'), '  Root  ');
        expect(screen.getByTestId('attributeOptionsGraphEmpty__addButton')).not.toBeDisabled();

        await userEvent.click(screen.getByTestId('attributeOptionsGraphEmpty__addButton'));

        expect(onOptionsChange).toHaveBeenCalledTimes(1);
        expect(onOptionsChange).toHaveBeenCalledWith([{id: '', name: 'Root', parents: []}]);
        expect(onOptionsChange.mock.calls[0][0][0]).toEqual(expect.objectContaining({parents: []}));
    });

    it('shows the uniqueness alert and does not add a duplicate top-level name', async () => {
        const onOptionsChange = jest.fn();
        const options: PropertyFieldOption[] = [{id: '', name: 'Engineering', parents: []}];
        renderWithContext(
            <AttributeOptionsGraphValues
                options={options}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.type(screen.getByTestId('attributeOptionsGraphAddTop__nameInput'), 'engineering{Enter}');

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('"engineering" already exists in this field.');
        expect(screen.getByTestId('attributeOptionsGraphAddTop__nameInput')).toHaveAttribute('aria-invalid', 'true');

        await userEvent.clear(screen.getByTestId('attributeOptionsGraphAddTop__nameInput'));
        await userEvent.type(screen.getByTestId('attributeOptionsGraphAddTop__nameInput'), 'ENGINEERING{Enter}');

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('"ENGINEERING" already exists in this field.');
    });

    it('disables the empty-state Add value control when disabled', () => {
        renderWithContext(
            <AttributeOptionsGraphValues
                options={[]}
                onOptionsChange={jest.fn()}
                disabled={true}
            />,
        );

        expect(screen.getByTestId('attributeOptionsGraphEmpty__addButton')).toBeDisabled();
        expect(screen.getByTestId('attributeOptionsGraphEmpty__nameInput')).toBeDisabled();
    });
});
