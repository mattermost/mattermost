// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ModalController from 'components/modal_controller';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AttributeExternalSource from './attribute_external_source';
import {NO_EXTERNAL_SOURCE_LINKS} from './external_source';
import type {ExternalSourceLinks} from './external_source';

const links = (overrides: Partial<ExternalSourceLinks>): ExternalSourceLinks => ({...NO_EXTERNAL_SOURCE_LINKS, ...overrides});

describe('AttributeExternalSource', () => {
    const onLink = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const renderComponent = (props: Partial<React.ComponentProps<typeof AttributeExternalSource>> = {}, initialState: Record<string, unknown> = {}) => {
        return renderWithContext(
            <div>
                <AttributeExternalSource
                    links={NO_EXTERNAL_SOURCE_LINKS}
                    fieldType='text'
                    onLink={onLink}
                    {...props}
                />
                <ModalController/>
            </div>,
            initialState,
        );
    };

    // Admin config and license under which OpenID Connect can be linked, with
    // one of the three conditions optionally broken.
    const openIdState = ({flag = true, licensed = true, enabled = true} = {}) => ({
        entities: {
            admin: {
                config: {
                    FeatureFlags: {OpenIdAttributeSync: flag},
                    OpenIdSettings: {Enable: enabled},
                },
            },
            general: {
                license: {IsLicensed: 'true', OpenId: licensed ? 'true' : 'false'},
            },
        },
    });

    it('renders no chips and offers both sources when neither is linked', async () => {
        renderComponent();

        expect(screen.queryByTestId('attributeExternalSourceSynced')).not.toBeInTheDocument();
        expect(screen.queryByTestId(/attributeExternalSourceChip-/)).not.toBeInTheDocument();
        expect(screen.getByRole('separator')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
        expect(screen.getByRole('menuitem', {name: /AD\/LDAP/})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /^SAML/})).toBeInTheDocument();
    });

    it('disables the add-source trigger when disableAdding is set, without disabling an existing chip\'s edit/remove actions', () => {
        renderComponent({links: links({ldap: 'department'}), disableAdding: true});

        expect(screen.getByTestId('attributeExternalSourceTrigger')).toBeDisabled();
        expect(screen.getByTestId('attributeExternalSourceTriggerLockWrap')).toBeInTheDocument();
        expect(screen.getByTestId('attributeExternalSourceChip-ldap-edit')).not.toBeDisabled();
        expect(screen.getByTestId('attributeExternalSourceChip-ldap-remove')).not.toBeDisabled();
    });

    it('renders a chip for a linked source prefixed by Synced with, and offers only the remaining source', async () => {
        renderComponent({links: links({ldap: 'department'})});

        expect(screen.getByTestId('attributeExternalSourceSynced')).toHaveTextContent(/^Synced with/);
        expect(screen.getByTestId('attributeExternalSourceChip-ldap')).toBeInTheDocument();
        expect(screen.queryByRole('separator')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
        expect(screen.getByRole('menuitem', {name: /^SAML/})).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: /^AD\/LDAP/})).not.toBeInTheDocument();
    });

    it('renders a chip\'s label as "<source>: <value>"', () => {
        renderComponent({links: links({ldap: 'department'})});

        expect(screen.getByTestId('attributeExternalSourceChip-ldap')).toHaveTextContent('AD/LDAP: department');
    });

    it('renders both chips once AD/LDAP and SAML are linked, offering OpenID Connect only as a disabled entry', async () => {
        renderComponent({links: links({ldap: 'department', saml: 'dept'})}, openIdState());

        expect(screen.getByTestId('attributeExternalSourceChip-ldap')).toBeInTheDocument();
        expect(screen.getByTestId('attributeExternalSourceChip-saml')).toBeInTheDocument();
        expect(screen.queryByRole('separator')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
        expect(screen.getAllByRole('menuitem')).toHaveLength(1);
        const openid = screen.getByRole('menuitem', {name: /^OpenID Connect/});
        expect(openid).toHaveAttribute('aria-disabled', 'true');
        expect(openid).toHaveTextContent('Can\'t be combined with AD/LDAP and SAML');
    });

    describe('OpenID Connect', () => {
        it('offers OpenID Connect, with its own modal copy, when it is licensed, set up and its flag is on', async () => {
            renderComponent({}, openIdState());

            await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
            const openid = screen.getByRole('menuitem', {name: /^OpenID Connect/});
            expect(openid).not.toHaveAttribute('aria-disabled');
            expect(openid).toHaveTextContent('Map claims at sign-in');

            await userEvent.click(openid);
            expect(await screen.findByText('Link to OpenID Connect')).toBeInTheDocument();
            expect(screen.getByText(/The claim in the ID token or userinfo response to sync this value from/)).toBeInTheDocument();
            expect(screen.getByText(/If the claim is missing at sign-in, the value is removed\./)).toBeInTheDocument();

            await userEvent.type(screen.getByRole('textbox'), 'address.country');
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
            expect(onLink).toHaveBeenCalledWith('openid', 'address.country');
        });

        it.each([
            [{flag: false}, 'Turned off on this server', 'Syncing attributes from OpenID Connect is turned off on this server.'],
            [{licensed: false}, 'Not included in your license', 'Your license doesn\'t include OpenID Connect.'],
            [{enabled: false}, 'Set up OpenID Connect first', 'Turn on OpenID Connect in System Console > Authentication > OpenID Connect to link attributes to its claims.'],
        ])('disables OpenID Connect when %p, saying why inline and in a tooltip', async (broken, label, tooltip) => {
            renderComponent({}, openIdState(broken));

            await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
            const openid = screen.getByRole('menuitem', {name: /^OpenID Connect/});
            expect(openid).toHaveAttribute('aria-disabled', 'true');
            expect(openid).toHaveTextContent(label);

            await userEvent.hover(screen.getByTestId('attributeExternalSourceBlocked-openid'));
            expect(await screen.findByText(tooltip)).toBeInTheDocument();

            // AD/LDAP and SAML stay available.
            expect(screen.getByRole('menuitem', {name: /^AD\/LDAP/})).not.toHaveAttribute('aria-disabled');
            expect(screen.getByRole('menuitem', {name: /^SAML/})).not.toHaveAttribute('aria-disabled');
        });

        it('keeps an existing OpenID Connect link as a chip even when OpenID Connect is no longer available', () => {
            renderComponent({links: links({openid: 'department'})}, openIdState({enabled: false}));

            expect(screen.getByTestId('attributeExternalSourceChip-openid')).toHaveTextContent('OpenID Connect: department');
            expect(screen.getByTestId('attributeExternalSourceChip-openid-edit')).not.toBeDisabled();
            expect(screen.getByTestId('attributeExternalSourceChip-openid-remove')).not.toBeDisabled();
        });

        it('disables AD/LDAP and SAML while OpenID Connect is linked, and explains why', async () => {
            renderComponent({links: links({openid: 'department'})}, openIdState());

            await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
            for (const name of [/^AD\/LDAP/, /^SAML/]) {
                const item = screen.getByRole('menuitem', {name});
                expect(item).toHaveAttribute('aria-disabled', 'true');
                expect(item).toHaveTextContent('Can\'t be combined with OpenID Connect');
            }

            await userEvent.hover(screen.getByTestId('attributeExternalSourceBlocked-saml'));
            expect(await screen.findByText('An attribute synced from OpenID Connect can\'t also sync from AD/LDAP or SAML. Remove the OpenID Connect link to link SAML.')).toBeInTheDocument();
        });

        it('disables OpenID Connect while AD/LDAP is linked, and names the link to remove', async () => {
            renderComponent({links: links({ldap: 'department'})}, openIdState());

            await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
            expect(screen.getByRole('menuitem', {name: /^SAML/})).not.toHaveAttribute('aria-disabled');
            expect(screen.getByRole('menuitem', {name: /^OpenID Connect/})).toHaveAttribute('aria-disabled', 'true');

            await userEvent.hover(screen.getByTestId('attributeExternalSourceBlocked-openid'));
            expect(await screen.findByText('An attribute synced from OpenID Connect can\'t also sync from AD/LDAP or SAML. Remove the AD/LDAP link to link OpenID Connect.')).toBeInTheDocument();
        });
    });

    it('opens the modal pre-filled and empty when adding a new link, with no type-mismatch warning on a Text field', async () => {
        renderComponent({fieldType: 'text'});

        await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
        await userEvent.click(screen.getByRole('menuitem', {name: /AD\/LDAP/}));

        const input = await screen.findByRole('textbox');
        expect(input).toHaveValue('');
        expect(screen.queryByText(/converted to a TEXT attribute/i)).not.toBeInTheDocument();
    });

    it('shows the type-mismatch warning when the current field type cannot be synced', async () => {
        renderComponent({fieldType: 'rank'});

        await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
        await userEvent.click(screen.getByRole('menuitem', {name: /AD\/LDAP/}));

        await screen.findByRole('textbox');
        expect(screen.getByText(/converted to a TEXT attribute/i)).toBeInTheDocument();
    });

    it.each(['select', 'multiselect', 'phone'] as const)('shows no type-mismatch warning for %s, which a source can populate as it is', async (fieldType) => {
        renderComponent({fieldType});

        await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
        await userEvent.click(screen.getByRole('menuitem', {name: /AD\/LDAP/}));

        await screen.findByRole('textbox');
        expect(screen.queryByText(/converted to a TEXT attribute/i)).not.toBeInTheDocument();
    });

    it('opens a linked chip\'s edit action pre-filled with the current value', async () => {
        renderComponent({links: links({ldap: 'department'})});

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
        renderComponent({links: links({ldap: 'department'})});

        await userEvent.click(screen.getByTestId('attributeExternalSourceChip-ldap-edit'));

        const input = await screen.findByRole('textbox');
        await userEvent.clear(input);
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(onLink).toHaveBeenCalledWith('ldap', '');
    });

    it('calls onLink directly with an empty value when a chip\'s remove action is clicked, without opening the modal', async () => {
        renderComponent({links: links({ldap: 'department'})});

        await userEvent.click(screen.getByTestId('attributeExternalSourceChip-ldap-remove'));

        expect(onLink).toHaveBeenCalledWith('ldap', '');
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('moves focus to the trigger when removing a chip drops the link count from 2 to 1', async () => {
        const {rerender} = renderComponent({links: links({ldap: 'department', saml: 'dept'})});

        rerender(
            <div>
                <AttributeExternalSource
                    links={links({saml: 'dept'})}
                    fieldType='text'
                    onLink={onLink}
                />
                <ModalController/>
            </div>,
        );

        await waitFor(() => expect(screen.getByTestId('attributeExternalSourceTrigger')).toHaveFocus());
    });

    it('moves focus to the trigger, rather than announcing a Type switch, when the last chip of a synced Select is removed', async () => {
        const {rerender} = renderComponent({links: links({ldap: 'department'}), fieldType: 'select'});

        rerender(
            <div>
                <AttributeExternalSource
                    links={NO_EXTERNAL_SOURCE_LINKS}
                    fieldType='select'
                    onLink={onLink}
                />
                <ModalController/>
            </div>,
        );

        await waitFor(() => expect(screen.getByTestId('attributeExternalSourceTrigger')).toHaveFocus());
        expect(screen.getByTestId('attributeExternalSourceStatus')).toHaveTextContent('');
    });

    it('renders an explicit status message when both links are cleared by a Type switch, and does not steal focus from the Type control', async () => {
        const {rerender} = renderComponent({links: links({ldap: 'department', saml: 'dept'})});

        rerender(
            <div>
                <AttributeExternalSource
                    links={NO_EXTERNAL_SOURCE_LINKS}
                    fieldType='rank'
                    onLink={onLink}
                />
                <ModalController/>
            </div>,
        );

        await waitFor(() => expect(screen.getByTestId('attributeExternalSourceStatus')).toHaveTextContent('External source links removed'));
        expect(screen.getByTestId('attributeExternalSourceTrigger')).not.toHaveFocus();
    });

    it('renders the status message (not a focus move) when a Type switch clears a single link -- distinguished from a chip removal by the fieldType change, not link count', async () => {
        const {rerender} = renderComponent({links: links({ldap: 'department'})});

        rerender(
            <div>
                <AttributeExternalSource
                    links={NO_EXTERNAL_SOURCE_LINKS}
                    fieldType='rank'
                    onLink={onLink}
                />
                <ModalController/>
            </div>,
        );

        await waitFor(() => expect(screen.getByTestId('attributeExternalSourceStatus')).toHaveTextContent('External source link removed'));
        expect(screen.getByTestId('attributeExternalSourceTrigger')).not.toHaveFocus();
    });

    it('re-announces the status message on a second occurrence of the same transition', async () => {
        const {rerender} = renderComponent({links: links({ldap: 'department', saml: 'dept'})});

        const clearBoth = () => rerender(
            <div>
                <AttributeExternalSource
                    links={NO_EXTERNAL_SOURCE_LINKS}
                    fieldType='rank'
                    onLink={onLink}
                />
                <ModalController/>
            </div>,
        );
        const relinkBoth = () => rerender(
            <div>
                <AttributeExternalSource
                    links={links({ldap: 'department', saml: 'dept'})}
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
