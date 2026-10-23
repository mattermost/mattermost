// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {act, fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

import AddBot from './add_bot';
import type {Props} from './add_bot';

describe('components/integrations/bots/AddBot', () => {
    const team = TestHelper.getTeamMock();
    const FROZEN_NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const actions = {
        createBot: jest.fn(),
        createBotWithEventSubscription: jest.fn(),
        patchBot: jest.fn(),
        uploadProfileImage: jest.fn(),
        setDefaultProfileImage: jest.fn(),
        createUserAccessToken: jest.fn(),
        updateUserRoles: jest.fn(),
        getCustomProfileAttributeFields: jest.fn().mockResolvedValue({data: []}),
        getCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {}}),
        updateUserCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {}}),
        getBotEventSubscription: jest.fn().mockResolvedValue({data: null}),
        upsertBotEventSubscription: jest.fn(),
        deleteBotEventSubscription: jest.fn(),
    };

    const baseProps = {
        maxFileSize: 100,
        maxLifetimeDays: 0,
        team,
        editingUserHasManageSystem: true,
        attributesEnabled: false,
        attributeFields: [] as UserPropertyField[],
        eventDeliveryEnabled: false,
        canManageRoles: true,
    };

    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(FROZEN_NOW);
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('blank', () => {
        const {container} = renderWithContext(
            <AddBot
                {...baseProps}
                actions={actions}
            />,
        );

        const usernameInput = container.querySelector('#username') as HTMLInputElement;
        const displayNameInput = container.querySelector('#displayName') as HTMLInputElement;
        const descriptionInput = container.querySelector('#description') as HTMLInputElement;

        expect(usernameInput).toBeInTheDocument();
        expect(usernameInput.value).toBe('');
        expect(displayNameInput).toBeInTheDocument();
        expect(displayNameInput.value).toBe('');
        expect(descriptionInput).toBeInTheDocument();
        expect(descriptionInput.value).toBe('');
        expect(container).toMatchSnapshot();
    });

    it('edit bot', () => {
        const bot = TestHelper.getBotMock({});
        const {container} = renderWithContext(
            <AddBot
                {...baseProps}
                bot={bot}
                actions={actions}
            />,
        );

        const usernameInput = container.querySelector('#username') as HTMLInputElement;
        const displayNameInput = container.querySelector('#displayName') as HTMLInputElement;
        const descriptionInput = container.querySelector('#description') as HTMLInputElement;

        expect(usernameInput).toBeInTheDocument();
        expect(usernameInput.value).toBe(bot.username);
        expect(displayNameInput).toBeInTheDocument();
        expect(displayNameInput.value).toBe(bot.display_name);
        expect(descriptionInput).toBeInTheDocument();
        expect(descriptionInput.value).toBe(bot.description);
    });

    it('creates the default token without expiry when no maximum lifetime is configured', async () => {
        const bot = TestHelper.getBotMock({user_id: 'bot-user-id', username: 'testbot'});
        const createBot = jest.fn().mockResolvedValue({data: bot});
        const createUserAccessToken = jest.fn().mockResolvedValue({data: TestHelper.getUserAccessTokenMock({token: 'default-secret'})});

        renderWithContext(
            <AddBot
                {...baseProps}
                actions={{...actions, createBot, createUserAccessToken}}
            />,
        );

        fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'testbot'}});
        expect(screen.getByText('Default access token')).toBeInTheDocument();
        expect(screen.getByLabelText('Default token expires')).toBeInTheDocument();
        expect(screen.getByText('No expiry')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Create Bot Account'));

        await waitFor(() => expect(createUserAccessToken).toHaveBeenCalledWith(bot.user_id, 'Default Token', undefined));
        expect(getHistory().push).toHaveBeenCalledWith(`/${team.name}/integrations/confirm?type=bots&id=${bot.user_id}&token=default-secret`);
    });

    it('creates the default token with clamped expiry when a maximum lifetime is configured', async () => {
        const bot = TestHelper.getBotMock({user_id: 'bot-user-id', username: 'testbot'});
        const createBot = jest.fn().mockResolvedValue({data: bot});
        const createUserAccessToken = jest.fn().mockResolvedValue({data: TestHelper.getUserAccessTokenMock({token: 'default-secret'})});

        renderWithContext(
            <AddBot
                {...baseProps}
                maxLifetimeDays={30}
                actions={{...actions, createBot, createUserAccessToken}}
            />,
        );

        fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'testbot'}});
        expect(screen.getByText('Default access token')).toBeInTheDocument();
        expect(screen.getByLabelText('Default token expires')).toBeInTheDocument();
        expect(screen.queryByText('No expiry')).not.toBeInTheDocument();
        expect(screen.getByText('Tokens can be valid for up to 30 days.')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Create Bot Account'));

        await waitFor(() => expect(createUserAccessToken).toHaveBeenCalledWith(bot.user_id, 'Default Token', expect.any(Number)));
        const expiresAt = createUserAccessToken.mock.calls[0][2];
        expect(expiresAt).toBeGreaterThan(FROZEN_NOW + (29 * DAY_MS));
        expect(expiresAt).toBeLessThanOrEqual(FROZEN_NOW + (30 * DAY_MS) + 1000);
    });

    describe('attributes', () => {
        const historyMock = getHistory();
        const LIST_URL = `/${team.name}/integrations/bots`;
        const CONFIRM_URL = `/${team.name}/integrations/confirm?type=bots&id=bot-user-id&token=default-secret`;

        const buildField = (overrides: Partial<UserPropertyField> = {}, attrs: Partial<UserPropertyField['attrs']> = {}): UserPropertyField => ({
            id: 'field-1',
            name: 'department',
            type: 'text',
            group_id: 'custom_profile_attributes',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            created_by: '',
            updated_by: '',
            target_id: '',
            target_type: '',
            object_type: 'user',
            ...overrides,
            attrs: {sort_order: 0, visibility: 'when_set', value_type: '', ...attrs},
        });

        const FIELDS = [
            buildField({id: 'dept', name: 'dept'}, {display_name: 'Department', sort_order: 2}),
            buildField({id: 'skills', name: 'skills', type: 'multiselect'}, {display_name: 'Skills', sort_order: 1, options: [{id: 's1', name: 'Go'}, {id: 's2', name: 'React'}]}),
            buildField({id: 'clearance', name: 'clearance', type: 'select'}, {display_name: 'Clearance', sort_order: 3, required: true, options: [{id: 'c1', name: 'Secret'}]}),
            buildField({id: 'badge', name: 'badge'}, {display_name: 'Badge', sort_order: 4, protected: true}),
            buildField({id: 'synced', name: 'synced'}, {display_name: 'Synced', sort_order: 5, ldap: 'title'}),
            buildField({id: 'adminOnly', name: 'adminOnly'}, {display_name: 'Admin Only', sort_order: 6, managed: 'admin'}),
            buildField({id: 'hidden', name: 'hidden'}, {display_name: 'Hidden', sort_order: 7, access_mode: 'source_only'}),
            buildField({id: 'email', name: 'email'}, {display_name: 'Email', sort_order: 8, value_type: 'email'}),
        ];

        const editBot = TestHelper.getBotMock({user_id: 'bot-user-id', username: 'testbot', owner_id: 'owner'});

        const buildActions = () => ({
            createBot: jest.fn().mockResolvedValue({data: TestHelper.getBotMock({user_id: 'bot-user-id', username: 'testbot'})}),
            patchBot: jest.fn().mockResolvedValue({data: editBot}),
            uploadProfileImage: jest.fn().mockResolvedValue({data: true}),
            setDefaultProfileImage: jest.fn().mockResolvedValue({data: true}),
            createUserAccessToken: jest.fn().mockResolvedValue({data: TestHelper.getUserAccessTokenMock({token: 'default-secret'})}),
            updateUserRoles: jest.fn().mockResolvedValue({data: true}),
            getCustomProfileAttributeFields: jest.fn().mockResolvedValue({data: FIELDS}),
            getCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {}}),
            updateUserCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {}}),
            createBotWithEventSubscription: jest.fn(),
            getBotEventSubscription: jest.fn().mockResolvedValue({data: null}),
            upsertBotEventSubscription: jest.fn(),
            deleteBotEventSubscription: jest.fn(),
        });

        const renderAddBot = (overrides: Partial<Props> = {}, actionOverrides: Partial<ReturnType<typeof buildActions>> = {}) => {
            const botActions = {...buildActions(), ...actionOverrides};
            const result = renderWithContext(
                <AddBot
                    {...baseProps}
                    attributesEnabled={true}
                    attributeFields={FIELDS}
                    {...overrides}
                    actions={botActions}
                />,
                {plugins: {plugins: {}}},
            );
            return {...result, actions: botActions};
        };

        const renderEdit = (values: Record<string, unknown>, overrides: Partial<Props> = {}, actionOverrides: Partial<ReturnType<typeof buildActions>> = {}) => renderAddBot(
            {bot: editBot, ...overrides},
            {getCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: values}), ...actionOverrides},
        );

        const addAttribute = async (name: string) => {
            await waitForAttributesReady();
            await userEvent.click(screen.getByRole('button', {name: 'Add attribute'}));
            await userEvent.click(await screen.findByRole('menuitem', {name}));
        };

        const submit = (label: 'Create Bot Account' | 'Update') => fireEvent.click(screen.getByText(label));

        const typeUsername = () => fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'testbot'}});

        const setRoleSelect = (container: HTMLElement, value: string) => fireEvent.change(container.querySelector('select')!, {target: {value}});

        const waitForAttributesReady = () => waitFor(() => expect(screen.getByRole('button', {name: 'Add attribute'})).toBeEnabled());

        beforeAll(() => {
            jest.useRealTimers();
        });

        afterAll(() => {
            jest.useFakeTimers().setSystemTime(FROZEN_NOW);
        });

        describe('gating and loading', () => {
            test('does not render the section or fetch when attributes are disabled', () => {
                const {actions: botActions} = renderAddBot({attributesEnabled: false, attributeFields: []});

                expect(screen.queryByTestId('botAttributesSection')).not.toBeInTheDocument();
                expect(botActions.getCustomProfileAttributeFields).not.toHaveBeenCalled();
                expect(botActions.getCustomProfileAttributeValues).not.toHaveBeenCalled();
            });

            test.each([
                ['none are', []],
                ['some are', FIELDS],
            ])('create: fetches fields when %s loaded', async (_, attributeFields) => {
                const {actions: botActions} = renderAddBot({attributeFields});

                expect(screen.getByTestId('botAttributesSection')).toBeInTheDocument();
                expect(screen.getByRole('button', {name: 'Add attribute'})).toBeDisabled();
                await waitForAttributesReady();
                expect(botActions.getCustomProfileAttributeFields).toHaveBeenCalledTimes(1);
                expect(botActions.getCustomProfileAttributeValues).not.toHaveBeenCalled();
            });

            test('create: a field load error shows the section error and still creates the bot', async () => {
                const {actions: botActions} = renderAddBot(
                    {attributeFields: []},
                    {getCustomProfileAttributeFields: jest.fn().mockResolvedValue({error: {message: 'x'}})},
                );

                await screen.findByTestId('botAttributesLoadError');
                typeUsername();
                submit('Create Bot Account');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(CONFIRM_URL));
                expect(botActions.createBot).toHaveBeenCalled();
                expect(botActions.updateUserCustomProfileAttributeValues).not.toHaveBeenCalled();
            });
        });

        describe('edit', () => {
            test('seeds rows from the bot\'s values', async () => {
                const {actions: botActions} = renderEdit({dept: 'Eng', skills: ['s1'], hidden: 'h', gone: 'x'});

                await screen.findByTestId('bot-attribute-label-dept');
                expect(botActions.getCustomProfileAttributeValues).toHaveBeenCalledWith('bot-user-id');
                expect(botActions.getCustomProfileAttributeFields).toHaveBeenCalledTimes(1);
                expect(screen.getByRole('textbox', {name: 'Department'})).toHaveValue('Eng');
                expect(screen.getByTestId('bot-attribute-label-skills')).toBeInTheDocument();
                expect(screen.queryByTestId('bot-attribute-label-hidden')).not.toBeInTheDocument();
                expect(screen.queryByTestId('bot-attribute-label-gone')).not.toBeInTheDocument();
                expect(screen.getByRole('button', {name: 'Add attribute'})).not.toHaveFocus();
            });

            test('locked and required-with-value rows have no trash', async () => {
                renderEdit({badge: 'B', clearance: 'c1', dept: 'Eng'});

                await screen.findByTestId('bot-attribute-label-dept');
                expect(screen.getByRole('textbox', {name: /Badge/})).toBeDisabled();
                expect(screen.queryByTestId('bot-attribute-remove-badge')).not.toBeInTheDocument();
                expect(screen.queryByTestId('bot-attribute-remove-clearance')).not.toBeInTheDocument();
                expect(screen.getByTestId('bot-attribute-remove-dept')).toBeInTheDocument();
            });

            test('removing rows sends cleared values and navigates', async () => {
                const {actions: botActions} = renderEdit({dept: 'Eng', skills: ['s1']});

                await screen.findByTestId('bot-attribute-label-dept');
                await userEvent.click(screen.getByRole('button', {name: 'Remove Department'}));
                await userEvent.click(screen.getByRole('button', {name: 'Remove Skills'}));
                submit('Update');

                await waitFor(() => expect(botActions.updateUserCustomProfileAttributeValues).toHaveBeenCalledWith('bot-user-id', {dept: '', skills: []}));
                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(LIST_URL));
            });

            test('an unchanged form makes no attributes call', async () => {
                const {actions: botActions} = renderEdit({dept: 'Eng'});

                await screen.findByTestId('bot-attribute-label-dept');
                submit('Update');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(LIST_URL));
                expect(botActions.updateUserCustomProfileAttributeValues).not.toHaveBeenCalled();
            });

            test('an attributes failure keeps the page, and a retry resends the changes', async () => {
                const updateUserCustomProfileAttributeValues = jest.fn().
                    mockResolvedValueOnce({error: {message: 'Nope'}}).
                    mockResolvedValueOnce({data: {dept: 'Ops'}});
                renderEdit({dept: 'Eng'}, {}, {updateUserCustomProfileAttributeValues});

                await screen.findByTestId('bot-attribute-label-dept');
                fireEvent.change(screen.getByRole('textbox', {name: 'Department'}), {target: {value: 'Ops'}});
                submit('Update');

                await screen.findByText('The bot was updated, but its attributes could not be saved. Nope');
                expect(historyMock.push).not.toHaveBeenCalled();
                expect(screen.getByText('Update')).toBeInTheDocument();

                submit('Update');
                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(LIST_URL));
                expect(updateUserCustomProfileAttributeValues).toHaveBeenCalledTimes(2);
                expect(updateUserCustomProfileAttributeValues).toHaveBeenNthCalledWith(1, 'bot-user-id', {dept: 'Ops'});
                expect(updateUserCustomProfileAttributeValues).toHaveBeenNthCalledWith(2, 'bot-user-id', {dept: 'Ops'});
            });

            test('after a successful attributes save, a roles failure retry does not resend attributes', async () => {
                const updateUserRoles = jest.fn().
                    mockResolvedValueOnce({error: {message: 'Denied'}}).
                    mockResolvedValueOnce({data: true});
                const {container, actions: botActions} = renderEdit({dept: 'Eng'}, {roles: 'system_user'}, {updateUserRoles});

                await screen.findByTestId('bot-attribute-label-dept');
                fireEvent.change(screen.getByRole('textbox', {name: 'Department'}), {target: {value: 'Ops'}});
                setRoleSelect(container, 'System Admin');
                submit('Update');

                await screen.findByText('The bot was updated, but its role and post permissions could not be saved. Denied');
                expect(historyMock.push).not.toHaveBeenCalled();

                submit('Update');
                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(LIST_URL));
                expect(updateUserRoles).toHaveBeenCalledTimes(2);
                expect(botActions.updateUserCustomProfileAttributeValues).toHaveBeenCalledTimes(1);
            });

            test('multiple failures are all listed', async () => {
                const {container} = renderEdit(
                    {dept: 'Eng'},
                    {roles: 'system_user'},
                    {
                        updateUserRoles: jest.fn().mockResolvedValue({error: {message: 'Denied'}}),
                        updateUserCustomProfileAttributeValues: jest.fn().mockResolvedValue({error: {message: 'Nope'}}),
                    },
                );

                await screen.findByTestId('bot-attribute-label-dept');
                fireEvent.change(screen.getByRole('textbox', {name: 'Department'}), {target: {value: 'Ops'}});
                setRoleSelect(container, 'System Admin');
                submit('Update');

                await screen.findByText('The bot was updated, but its role and post permissions could not be saved. Denied');
                expect(screen.getByText('The bot was updated, but its attributes could not be saved. Nope')).toBeInTheDocument();
                expect(historyMock.push).not.toHaveBeenCalled();
            });

            test('a patchBot failure stops before roles and attributes', async () => {
                const {actions: botActions} = renderEdit({dept: 'Eng'}, {roles: 'system_user'}, {patchBot: jest.fn().mockResolvedValue({error: {message: 'Patch failed'}})});

                await screen.findByTestId('bot-attribute-label-dept');
                fireEvent.change(screen.getByRole('textbox', {name: 'Department'}), {target: {value: 'Ops'}});
                submit('Update');

                await screen.findByText('Patch failed');
                expect(botActions.updateUserRoles).not.toHaveBeenCalled();
                expect(botActions.updateUserCustomProfileAttributeValues).not.toHaveBeenCalled();
                expect(historyMock.push).not.toHaveBeenCalled();
            });

            test('values load error blocks attribute writes but saves the bot', async () => {
                const {actions: botActions} = renderEdit({}, {}, {getCustomProfileAttributeValues: jest.fn().mockResolvedValue({error: {message: 'x'}})});

                await screen.findByTestId('botAttributesLoadError');
                submit('Update');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(LIST_URL));
                expect(botActions.patchBot).toHaveBeenCalled();
                expect(botActions.updateUserCustomProfileAttributeValues).not.toHaveBeenCalled();
            });

            test('retrying a failed values load seeds rows and focuses Add attribute', async () => {
                const getCustomProfileAttributeValues = jest.fn().
                    mockResolvedValueOnce({error: {message: 'x'}}).
                    mockResolvedValueOnce({data: {dept: 'Eng'}});
                renderEdit({}, {}, {getCustomProfileAttributeValues});

                await userEvent.click(await screen.findByRole('button', {name: 'Try again'}));

                expect(await screen.findByRole('textbox', {name: 'Department'})).toHaveValue('Eng');
                expect(screen.queryByTestId('botAttributesLoadError')).not.toBeInTheDocument();
                expect(getCustomProfileAttributeValues).toHaveBeenCalledTimes(2);
                await waitFor(() => expect(screen.getByRole('button', {name: 'Add attribute'})).toHaveFocus());
            });

            test('a failed retry shows the load error again and refocuses Try again', async () => {
                const getCustomProfileAttributeValues = jest.fn().mockResolvedValue({error: {message: 'x'}});
                renderEdit({}, {}, {getCustomProfileAttributeValues});

                await userEvent.click(await screen.findByRole('button', {name: 'Try again'}));

                await waitFor(() => expect(getCustomProfileAttributeValues).toHaveBeenCalledTimes(2));
                expect(await screen.findByTestId('botAttributesLoadError')).toBeInTheDocument();
                expect(screen.queryByTestId('bot-attribute-list')).not.toBeInTheDocument();
                await waitFor(() => expect(screen.getByRole('button', {name: 'Try again'})).toHaveFocus());
            });

            test('non-admin owner', async () => {
                const {actions: botActions} = renderEdit({}, {editingUserHasManageSystem: false, canManageRoles: false, roles: 'system_user'});

                await waitForAttributesReady();
                await userEvent.click(screen.getByRole('button', {name: 'Add attribute'}));
                await screen.findByRole('menuitem', {name: 'Department'});
                expect(screen.queryByRole('menuitem', {name: 'Admin Only'})).not.toBeInTheDocument();
                expect(screen.queryByRole('menuitem', {name: 'Manage attributes'})).not.toBeInTheDocument();
                await userEvent.click(screen.getByRole('menuitem', {name: 'Department'}));

                fireEvent.change(await screen.findByRole('textbox', {name: 'Department'}), {target: {value: 'Eng'}});
                submit('Update');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(LIST_URL));
                expect(botActions.updateUserRoles).not.toHaveBeenCalled();
                expect(botActions.updateUserCustomProfileAttributeValues).toHaveBeenCalledWith('bot-user-id', {dept: 'Eng'});
            });
        });

        describe('roles', () => {
            const ROLES = 'system_user system_user_access_token system_post_all';

            test('edit: preserves extra roles when the role changes', async () => {
                const {container, actions: botActions} = renderEdit({}, {roles: ROLES});

                await waitForAttributesReady();
                setRoleSelect(container, 'System Admin');
                submit('Update');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(LIST_URL));
                expect(botActions.updateUserRoles).toHaveBeenCalledWith('bot-user-id', 'system_user system_user_access_token system_admin');
            });

            test('edit: no roles call when nothing changed', async () => {
                const {actions: botActions} = renderEdit({}, {roles: ROLES});

                await waitForAttributesReady();
                submit('Update');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(LIST_URL));
                expect(botActions.updateUserRoles).not.toHaveBeenCalled();
            });

            test('edit: no roles call when the bot user\'s roles are unknown', async () => {
                const {container, actions: botActions} = renderEdit({});

                await waitForAttributesReady();
                expect(container.querySelector('select')).toBeDisabled();
                setRoleSelect(container, 'System Admin');
                submit('Update');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(LIST_URL));
                expect(botActions.updateUserRoles).not.toHaveBeenCalled();
            });

            test('edit: a role change made while saving is not sent', async () => {
                let resolvePatch: (value: unknown) => void = () => {};
                const patchBot = jest.fn().mockReturnValue(new Promise((resolve) => {
                    resolvePatch = resolve;
                }));
                const {container, actions: botActions} = renderEdit({}, {roles: 'system_user'}, {patchBot});

                await waitForAttributesReady();
                submit('Update');
                setRoleSelect(container, 'System Admin');
                await act(async () => resolvePatch({data: editBot}));

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(LIST_URL));
                expect(botActions.updateUserRoles).not.toHaveBeenCalled();
            });

            test('edit: roles that arrive after mount seed the controls', async () => {
                const {container, rerender, actions: botActions} = renderEdit({});

                await waitForAttributesReady();
                expect(container.querySelector('select')).toBeDisabled();
                rerender(
                    <AddBot
                        {...baseProps}
                        attributesEnabled={true}
                        attributeFields={FIELDS}
                        bot={editBot}
                        roles='system_user system_admin'
                        actions={botActions}
                    />,
                );
                expect(container.querySelector('select')).toBeEnabled();
                expect(container.querySelector('select')).toHaveValue('System Admin');
                submit('Update');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(LIST_URL));
                expect(botActions.updateUserRoles).not.toHaveBeenCalled();
            });

            test('MANAGE_ROLES, not MANAGE_SYSTEM, gates the role controls and the roles call', async () => {
                const {container, actions: botActions} = renderEdit({}, {roles: 'system_user', editingUserHasManageSystem: false, canManageRoles: true});

                await waitForAttributesReady();
                expect(container.querySelector('select')).toBeEnabled();
                setRoleSelect(container, 'System Admin');
                submit('Update');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(LIST_URL));
                expect(botActions.updateUserRoles).toHaveBeenCalledWith('bot-user-id', 'system_user system_admin');
            });

            test('without MANAGE_ROLES the role controls are disabled even with MANAGE_SYSTEM', async () => {
                const {container} = renderEdit({}, {roles: 'system_user', editingUserHasManageSystem: true, canManageRoles: false});

                await waitForAttributesReady();
                expect(container.querySelector('select')).toBeDisabled();
                expect(screen.getByLabelText('post:all')).toBeDisabled();
                expect(screen.getByLabelText('post:channels')).toBeDisabled();
            });
        });

        describe('create', () => {
            test('runs createBot, token, then attributes, and lands on confirm', async () => {
                const {actions: botActions} = renderAddBot();

                typeUsername();
                await addAttribute('Department');
                fireEvent.change(await screen.findByRole('textbox', {name: 'Department'}), {target: {value: 'Eng'}});
                submit('Create Bot Account');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(CONFIRM_URL));
                const createOrder = botActions.createBot.mock.invocationCallOrder[0];
                const tokenOrder = botActions.createUserAccessToken.mock.invocationCallOrder[0];
                const attributesOrder = botActions.updateUserCustomProfileAttributeValues.mock.invocationCallOrder[0];
                expect(createOrder).toBeLessThan(tokenOrder);
                expect(tokenOrder).toBeLessThan(attributesOrder);
                expect(botActions.updateUserCustomProfileAttributeValues).toHaveBeenCalledWith('bot-user-id', {dept: 'Eng'});
                expect(botActions.updateUserRoles).not.toHaveBeenCalled();
            });

            test('an attributes failure still lands on confirm with a warning', async () => {
                renderAddBot({}, {updateUserCustomProfileAttributeValues: jest.fn().mockResolvedValue({error: {message: 'x', status_code: 403}})});

                typeUsername();
                await addAttribute('Department');
                fireEvent.change(await screen.findByRole('textbox', {name: 'Department'}), {target: {value: 'Eng'}});
                submit('Create Bot Account');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(`${CONFIRM_URL}&bot_warnings=attributes`));
            });

            test('a token failure still saves attributes and lands on the list with both warnings', async () => {
                const {actions: botActions} = renderAddBot({}, {
                    createUserAccessToken: jest.fn().mockResolvedValue({error: {message: 'x'}}),
                    updateUserCustomProfileAttributeValues: jest.fn().mockResolvedValue({error: {message: 'x'}}),
                });

                typeUsername();
                await addAttribute('Department');
                fireEvent.change(await screen.findByRole('textbox', {name: 'Department'}), {target: {value: 'Eng'}});
                submit('Create Bot Account');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(`${LIST_URL}?bot_warnings=token,attributes`));
                expect(botActions.updateUserCustomProfileAttributeValues).toHaveBeenCalledWith('bot-user-id', {dept: 'Eng'});
            });

            test('a token failure alone lands on the list with the token warning', async () => {
                renderAddBot({}, {createUserAccessToken: jest.fn().mockResolvedValue({error: {message: 'x'}})});

                typeUsername();
                submit('Create Bot Account');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(`${LIST_URL}?bot_warnings=token`));
            });

            test('System Admin sets roles once, and a failure is flagged', async () => {
                const {container, actions: botActions} = renderAddBot({}, {updateUserRoles: jest.fn().mockResolvedValue({error: {message: 'x'}})});

                typeUsername();
                setRoleSelect(container, 'System Admin');
                submit('Create Bot Account');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(`${CONFIRM_URL}&bot_warnings=roles`));
                expect(botActions.updateUserRoles).toHaveBeenCalledTimes(1);
                expect(botActions.updateUserRoles).toHaveBeenCalledWith('bot-user-id', 'system_user system_admin');
            });

            test('invalid attributes block createBot', async () => {
                const {actions: botActions} = renderAddBot();

                typeUsername();
                await addAttribute('Email');
                const input = await screen.findByRole('textbox', {name: 'Email'});
                fireEvent.change(input, {target: {value: 'nope'}});
                submit('Create Bot Account');

                expect(await screen.findByText('Fix the highlighted attributes before saving.')).toBeInTheDocument();
                expect(screen.getByText('Invalid email address')).toBeInTheDocument();
                expect(botActions.createBot).not.toHaveBeenCalled();

                fireEvent.change(input, {target: {value: 'bot@example.com'}});
                expect(screen.queryByText('Invalid email address')).not.toBeInTheDocument();
            });

            test('a required attribute added but left empty blocks createBot', async () => {
                const {actions: botActions} = renderAddBot();

                typeUsername();
                await addAttribute('Clearance');
                await screen.findByTestId('bot-attribute-label-clearance');
                submit('Create Bot Account');

                expect(await screen.findByText('This attribute is required.')).toBeInTheDocument();
                expect(botActions.createBot).not.toHaveBeenCalled();
            });

            test('an invalid username blocks createBot before any request', async () => {
                const {actions: botActions} = renderAddBot();

                fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'testbot.'}});
                submit('Create Bot Account');

                expect(await screen.findByText('Bot usernames cannot have a period as the last character')).toBeInTheDocument();
                expect(botActions.createBot).not.toHaveBeenCalled();
                expect(screen.getByText('Create Bot Account')).toBeInTheDocument();
            });

            test('no rows means no attributes call', async () => {
                const {actions: botActions} = renderAddBot();

                typeUsername();
                submit('Create Bot Account');

                await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(CONFIRM_URL));
                expect(botActions.updateUserCustomProfileAttributeValues).not.toHaveBeenCalled();
            });

            test('double submit creates one bot', () => {
                const {container, actions: botActions} = renderAddBot({}, {createBot: jest.fn().mockReturnValue(new Promise(() => {}))});
                const form = container.querySelector('form')!;

                typeUsername();
                act(() => {
                    fireEvent.submit(form);
                    fireEvent.submit(form);
                });

                expect(botActions.createBot).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('event delivery', () => {
        const historyMock = getHistory();
        const editBot = TestHelper.getBotMock({user_id: 'bot-user-id', username: 'testbot', owner_id: 'owner'});
        const subscription = {bot_user_id: 'bot-user-id', mode: 'push' as const, callback_url: 'https://old.example.com/hook', ignore_bot_authors: true, enabled: true, disabled_reason: '' as const, last_delivered_at: 0};
        const PUSH_URL = 'https://hook.example.com/events';

        const renderForm = (overrides: Partial<Props> = {}, actionOverrides: Partial<Props['actions']> = {}) => {
            const botActions = {
                ...actions,
                createBot: jest.fn().mockResolvedValue({data: editBot}),
                createBotWithEventSubscription: jest.fn().mockResolvedValue({data: {bot: editBot, eventSubscription: {...subscription, secret: 'whsec_created'}}}),
                patchBot: jest.fn().mockResolvedValue({data: editBot}),
                createUserAccessToken: jest.fn().mockResolvedValue({data: TestHelper.getUserAccessTokenMock({token: 'default-secret'})}),
                upsertBotEventSubscription: jest.fn().mockResolvedValue({data: {...subscription, secret: 'whsec_edit'}}),
                deleteBotEventSubscription: jest.fn().mockResolvedValue({data: {status: 'OK'}}),
                setDefaultProfileImage: jest.fn().mockResolvedValue({data: true}),
                ...actionOverrides,
            };
            renderWithContext(
                <AddBot
                    {...baseProps}
                    eventDeliveryEnabled={true}
                    {...overrides}
                    actions={botActions}
                />,
                {plugins: {plugins: {}}},
            );
            return botActions;
        };

        const chooseMode = (name: 'None' | 'Push' | 'Pull') => fireEvent.click(screen.getByRole('radio', {name}));
        const enterUrl = (url: string) => fireEvent.change(screen.getByLabelText('Callback URL'), {target: {value: url}});
        const typeUsername = () => fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'testbot'}});
        const submit = (label: 'Create Bot Account' | 'Update') => fireEvent.click(screen.getByText(label));

        beforeAll(() => {
            jest.useRealTimers();
        });

        afterAll(() => {
            jest.useFakeTimers().setSystemTime(FROZEN_NOW);
        });

        test('the section is hidden when event delivery is not enabled', () => {
            renderForm({eventDeliveryEnabled: false});

            expect(screen.queryByText('Event delivery')).not.toBeInTheDocument();
        });

        test('the mode decides which fields are shown', () => {
            renderForm();

            expect(screen.getByRole('radio', {name: 'None'})).toBeChecked();
            expect(screen.queryByLabelText('Callback URL')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Ignore messages from other bots')).not.toBeInTheDocument();

            chooseMode('Push');
            expect(screen.getByLabelText('Callback URL')).toBeInTheDocument();
            expect(screen.getByLabelText('Ignore messages from other bots')).toBeChecked();

            chooseMode('Pull');
            expect(screen.queryByLabelText('Callback URL')).not.toBeInTheDocument();
            expect(screen.getByLabelText('Ignore messages from other bots')).toBeInTheDocument();
        });

        test('push without a callback URL is rejected before any request', async () => {
            const botActions = renderForm();

            typeUsername();
            chooseMode('Push');
            submit('Create Bot Account');

            expect(await screen.findByText('Enter a callback URL for push delivery.')).toBeInTheDocument();
            expect(botActions.createBotWithEventSubscription).not.toHaveBeenCalled();
            expect(botActions.createBot).not.toHaveBeenCalled();
        });

        test('create sends the subscription and passes the secret to the confirm page', async () => {
            const botActions = renderForm();

            typeUsername();
            chooseMode('Push');
            enterUrl(` ${PUSH_URL} `);
            submit('Create Bot Account');

            await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(
                `/${team.name}/integrations/confirm?type=bots&id=bot-user-id&token=default-secret&secret=whsec_created`,
            ));
            expect(botActions.createBotWithEventSubscription).toHaveBeenCalledWith(
                expect.objectContaining({username: 'testbot'}),
                {mode: 'push', callback_url: PUSH_URL, ignore_bot_authors: true},
            );
            expect(botActions.createBot).not.toHaveBeenCalled();
        });

        test('create with None uses the plain create action', async () => {
            const botActions = renderForm();

            typeUsername();
            submit('Create Bot Account');

            await waitFor(() => expect(botActions.createBot).toHaveBeenCalled());
            expect(botActions.createBotWithEventSubscription).not.toHaveBeenCalled();
        });

        test('a server error on create is shown and nothing else runs', async () => {
            const botActions = renderForm({}, {createBotWithEventSubscription: jest.fn().mockResolvedValue({error: {message: 'Callback URL did not answer the challenge.'}})});

            typeUsername();
            chooseMode('Push');
            enterUrl(PUSH_URL);
            submit('Create Bot Account');

            expect(await screen.findByText('Callback URL did not answer the challenge.')).toBeInTheDocument();
            expect(botActions.createUserAccessToken).not.toHaveBeenCalled();
            expect(historyMock.push).not.toHaveBeenCalled();
        });

        test('edit shows the secret once instead of navigating when a subscription is created', async () => {
            const botActions = renderForm({bot: editBot});

            await waitFor(() => expect(screen.getByRole('radio', {name: 'None'})).toBeEnabled());
            chooseMode('Push');
            enterUrl(PUSH_URL);
            submit('Update');

            expect(await screen.findByText('whsec_edit')).toBeInTheDocument();
            expect(screen.getByRole('link', {name: 'Done'})).toBeInTheDocument();
            expect(botActions.upsertBotEventSubscription).toHaveBeenCalledWith('bot-user-id', {mode: 'push', callback_url: PUSH_URL, ignore_bot_authors: true});
            expect(historyMock.push).not.toHaveBeenCalled();
        });

        test('edit loads the existing subscription and an unchanged form saves nothing', async () => {
            const botActions = renderForm({bot: editBot}, {getBotEventSubscription: jest.fn().mockResolvedValue({data: subscription})});

            await waitFor(() => expect(screen.getByLabelText('Callback URL')).toHaveValue(subscription.callback_url));
            submit('Update');

            await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(`/${team.name}/integrations/bots`));
            expect(botActions.upsertBotEventSubscription).not.toHaveBeenCalled();
            expect(botActions.deleteBotEventSubscription).not.toHaveBeenCalled();
        });

        test('edit switching to None deletes the subscription', async () => {
            const botActions = renderForm({bot: editBot}, {getBotEventSubscription: jest.fn().mockResolvedValue({data: subscription})});

            await waitFor(() => expect(screen.getByLabelText('Callback URL')).toBeInTheDocument());
            chooseMode('None');
            submit('Update');

            await waitFor(() => expect(botActions.deleteBotEventSubscription).toHaveBeenCalledWith('bot-user-id'));
        });

        test('a server error on edit says the bot was updated but delivery was not saved', async () => {
            renderForm({bot: editBot}, {upsertBotEventSubscription: jest.fn().mockResolvedValue({error: {message: 'Callback URL did not answer the challenge.'}})});

            await waitFor(() => expect(screen.getByRole('radio', {name: 'None'})).toBeEnabled());
            chooseMode('Push');
            enterUrl(PUSH_URL);
            submit('Update');

            expect(await screen.findByText('The bot was updated, but its event delivery settings could not be saved. Callback URL did not answer the challenge.')).toBeInTheDocument();
            expect(historyMock.push).not.toHaveBeenCalled();
        });

        test('a retry after a partial failure does not repeat the saved subscription change', async () => {
            const updateUserRoles = jest.fn().mockResolvedValue({error: {message: 'Denied'}});
            const botActions = renderForm({bot: editBot, roles: 'system_user'}, {updateUserRoles, getBotEventSubscription: jest.fn().mockResolvedValue({data: subscription})});

            await waitFor(() => expect(screen.getByLabelText('Callback URL')).toBeInTheDocument());
            chooseMode('None');
            fireEvent.change(document.querySelector('select')!, {target: {value: 'System Admin'}});
            submit('Update');
            expect(await screen.findByText(/its role and post permissions could not be saved/)).toBeInTheDocument();
            submit('Update');

            await waitFor(() => expect(updateUserRoles).toHaveBeenCalledTimes(2));
            expect(botActions.deleteBotEventSubscription).toHaveBeenCalledTimes(1);
            expect(screen.queryByText(/event delivery settings could not be saved/)).not.toBeInTheDocument();
        });

        test('a failed subscription load hides the section and saves no change', async () => {
            const botActions = renderForm({bot: editBot}, {getBotEventSubscription: jest.fn().mockResolvedValue({error: {message: 'boom'}})});

            submit('Update');

            await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith(`/${team.name}/integrations/bots`));
            expect(screen.queryByText('Event delivery')).not.toBeInTheDocument();
            expect(botActions.upsertBotEventSubscription).not.toHaveBeenCalled();
            expect(botActions.deleteBotEventSubscription).not.toHaveBeenCalled();
        });
    });
});
