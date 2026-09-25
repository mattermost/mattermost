// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {CheckIcon, SyncIcon} from '@mattermost/compass-icons/components';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AttributeSelect from './attribute_select';
import type {AttributeSelectOption} from './attribute_select';

describe('AttributeSelect', () => {
    const text: AttributeSelectOption<'text' | 'select' | 'email'> = {
        id: 'text',
        icon: SyncIcon,
        label: defineMessage({id: 'test.text', defaultMessage: 'Text'}),
    };
    const select: AttributeSelectOption<'text' | 'select' | 'email'> = {
        id: 'select',
        icon: CheckIcon,
        label: defineMessage({id: 'test.select', defaultMessage: 'Select'}),
    };
    const email: AttributeSelectOption<'text' | 'select' | 'email'> = {
        id: 'email',
        icon: CheckIcon,
        label: defineMessage({id: 'test.email', defaultMessage: 'Email'}),
    };

    const renderComponent = (props: Partial<React.ComponentProps<typeof AttributeSelect>> = {}) => renderWithContext(
        <AttributeSelect
            idPrefix='attribute-type'
            dataTestId='attributeSelect'
            selected={text}
            options={[text, select]}
            ariaLabel='Type: Text'
            menuAriaLabel='Select type'
            {...props}
        />,
    );

    it('shows the selected option and opens a menu listing every option, reporting the chosen one', async () => {
        const onChange = jest.fn();
        renderComponent({onChange});

        const trigger = screen.getByTestId('attributeSelect');
        expect(trigger).toHaveTextContent('Text');
        expect(trigger).toHaveAccessibleName('Type: Text');
        expect(trigger).toBeEnabled();

        expect(trigger).toHaveAttribute('id', 'attribute-type-menu-button');

        await userEvent.click(trigger);
        expect(screen.getByRole('menu', {name: 'Select type'})).toHaveAttribute('id', 'attribute-type-menu');
        expect(screen.getByRole('menuitemradio', {name: 'Text'})).toHaveAttribute('id', 'attribute-type-text');
        expect(screen.getByRole('menuitemradio', {name: 'Text'})).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemradio', {name: 'Text'}).querySelector('svg')).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'Select'})).toHaveAttribute('aria-checked', 'false');

        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('select');
    });

    it('names the selected option even when it is absent from the menu, so a type the picker no longer offers still reads correctly', () => {
        renderComponent({selected: email, options: [text, select]});

        expect(screen.getByTestId('attributeSelect')).toHaveTextContent('Email');
        expect(screen.getByTestId('attributeSelect')).not.toHaveTextContent('Text');
    });

    it('opens no menu while disabled, and keeps the chevron since the value can still change later', async () => {
        const onChange = jest.fn();
        const {container} = renderComponent({disabled: true, onChange});

        const trigger = screen.getByTestId('attributeSelect');
        expect(trigger).toBeDisabled();
        expect(container.querySelector('.icon-chevron-down')).toBeInTheDocument();

        await userEvent.click(trigger);
        expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('renders a locked select as a disabled control with no chevron and no menu to open', async () => {
        const onChange = jest.fn();
        const {container} = renderComponent({locked: true, onChange});

        const trigger = screen.getByTestId('attributeSelect');
        expect(trigger).toHaveTextContent('Text');
        expect(trigger).toBeDisabled();
        expect(container.querySelector('.icon-chevron-down')).not.toBeInTheDocument();

        await userEvent.click(trigger);
        await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
        expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('defaults the menu to the single selected option when no option list is given', async () => {
        const onChange = jest.fn();
        renderComponent({selected: email, options: undefined, onChange});

        await userEvent.click(screen.getByTestId('attributeSelect'));
        expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
        expect(screen.getByRole('menuitemradio', {name: 'Email'})).toHaveAttribute('aria-checked', 'true');
    });
});
