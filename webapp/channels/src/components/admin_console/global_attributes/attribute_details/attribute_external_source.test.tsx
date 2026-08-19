// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ModalController from 'components/modal_controller';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AttributeExternalSource from './attribute_external_source';

describe('AttributeExternalSource', () => {
    const onLink = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const renderComponent = (props: Partial<React.ComponentProps<typeof AttributeExternalSource>> = {}) => {
        return renderWithContext(
            <div>
                <AttributeExternalSource
                    ldapAttr=''
                    samlAttr=''
                    fieldType='text'
                    onLink={onLink}
                    {...props}
                />
                <ModalController/>
            </div>,
        );
    };

    it('renders no chips and offers both sources when neither is linked', async () => {
        renderComponent();

        expect(screen.queryByTestId(/attributeExternalSourceChip-/)).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
        expect(screen.getByRole('menuitem', {name: /AD\/LDAP/})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /^SAML/})).toBeInTheDocument();
    });

    it('renders a chip for a linked source and offers only the remaining source', async () => {
        renderComponent({ldapAttr: 'department'});

        expect(screen.getByTestId('attributeExternalSourceChip-ldap')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
        expect(screen.getByRole('menuitem', {name: /^SAML/})).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: /AD\/LDAP/})).not.toBeInTheDocument();
    });

    it('renders a chip\'s label as "<source>: <value>"', () => {
        renderComponent({ldapAttr: 'department'});

        expect(screen.getByTestId('attributeExternalSourceChip-ldap')).toHaveTextContent('AD/LDAP: department');
    });

    it('renders both chips and omits the trigger entirely once both sources are linked', () => {
        renderComponent({ldapAttr: 'department', samlAttr: 'dept'});

        expect(screen.getByTestId('attributeExternalSourceChip-ldap')).toBeInTheDocument();
        expect(screen.getByTestId('attributeExternalSourceChip-saml')).toBeInTheDocument();
        expect(screen.queryByTestId('attributeExternalSourceTrigger')).not.toBeInTheDocument();
    });

    it('opens the modal pre-filled and empty when adding a new link, with no type-mismatch warning on a Text field', async () => {
        renderComponent({fieldType: 'text'});

        await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
        await userEvent.click(screen.getByRole('menuitem', {name: /AD\/LDAP/}));

        const input = await screen.findByRole('textbox');
        expect(input).toHaveValue('');
        expect(screen.queryByText(/converted to a TEXT attribute/i)).not.toBeInTheDocument();
    });

    it('shows the type-mismatch warning when the current field type is not Text', async () => {
        renderComponent({fieldType: 'select'});

        await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
        await userEvent.click(screen.getByRole('menuitem', {name: /AD\/LDAP/}));

        await screen.findByRole('textbox');
        expect(screen.getByText(/converted to a TEXT attribute/i)).toBeInTheDocument();
    });

    it('opens a linked chip\'s edit action pre-filled with the current value', async () => {
        renderComponent({ldapAttr: 'department'});

        await userEvent.click(screen.getByTestId('attributeExternalSourceChip-ldap-edit'));

        const input = await screen.findByRole('textbox');
        expect(input).toHaveValue('department');
    });

    it('calls onLink with the typed value when the modal is saved', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
        await userEvent.click(screen.getByRole('menuitem', {name: /^SAML/}));

        await userEvent.type(await screen.findByRole('textbox'), 'employeeID');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(onLink).toHaveBeenCalledWith('saml', 'employeeID');
    });

    it('calls onLink with an empty value when the modal is saved blank', async () => {
        renderComponent({ldapAttr: 'department'});

        await userEvent.click(screen.getByTestId('attributeExternalSourceChip-ldap-edit'));

        const input = await screen.findByRole('textbox');
        await userEvent.clear(input);
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(onLink).toHaveBeenCalledWith('ldap', '');
    });

    it('calls onLink directly with an empty value when a chip\'s remove action is clicked, without opening the modal', async () => {
        renderComponent({ldapAttr: 'department'});

        await userEvent.click(screen.getByTestId('attributeExternalSourceChip-ldap-remove'));

        expect(onLink).toHaveBeenCalledWith('ldap', '');
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('moves focus to the trigger when removing a chip drops the link count from 2 to 1', async () => {
        const {rerender} = renderComponent({ldapAttr: 'department', samlAttr: 'dept'});

        rerender(
            <div>
                <AttributeExternalSource
                    ldapAttr=''
                    samlAttr='dept'
                    fieldType='text'
                    onLink={onLink}
                />
                <ModalController/>
            </div>,
        );

        await waitFor(() => expect(screen.getByTestId('attributeExternalSourceTrigger')).toHaveFocus());
    });

    it('renders an explicit status message when both links are cleared by a Type switch, and does not steal focus from the Type control', async () => {
        const {rerender} = renderComponent({ldapAttr: 'department', samlAttr: 'dept'});

        rerender(
            <div>
                <AttributeExternalSource
                    ldapAttr=''
                    samlAttr=''
                    fieldType='select'
                    onLink={onLink}
                />
                <ModalController/>
            </div>,
        );

        await waitFor(() => expect(screen.getByTestId('attributeExternalSourceStatus')).toHaveTextContent('External source links removed'));
        expect(screen.getByTestId('attributeExternalSourceTrigger')).not.toHaveFocus();
    });

    it('renders the status message (not a focus move) when a Type switch clears a single link -- distinguished from a chip removal by fieldType, not link count', async () => {
        const {rerender} = renderComponent({ldapAttr: 'department'});

        rerender(
            <div>
                <AttributeExternalSource
                    ldapAttr=''
                    samlAttr=''
                    fieldType='select'
                    onLink={onLink}
                />
                <ModalController/>
            </div>,
        );

        await waitFor(() => expect(screen.getByTestId('attributeExternalSourceStatus')).toHaveTextContent('External source link removed'));
        expect(screen.getByTestId('attributeExternalSourceTrigger')).not.toHaveFocus();
    });

    it('re-announces the status message on a second occurrence of the same transition', async () => {
        const {rerender} = renderComponent({ldapAttr: 'department', samlAttr: 'dept'});

        const clearBoth = () => rerender(
            <div>
                <AttributeExternalSource
                    ldapAttr=''
                    samlAttr=''
                    fieldType='select'
                    onLink={onLink}
                />
                <ModalController/>
            </div>,
        );
        const relinkBoth = () => rerender(
            <div>
                <AttributeExternalSource
                    ldapAttr='department'
                    samlAttr='dept'
                    fieldType='text'
                    onLink={onLink}
                />
                <ModalController/>
            </div>,
        );

        clearBoth();
        await waitFor(() => expect(screen.getByTestId('attributeExternalSourceStatus')).toHaveTextContent('External source links removed'));

        relinkBoth();
        await waitFor(() => expect(screen.getByTestId('attributeExternalSourceStatus')).toHaveTextContent(''));

        clearBoth();
        await waitFor(() => expect(screen.getByTestId('attributeExternalSourceStatus')).toHaveTextContent('External source links removed'));
    });
});
