// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {
    type App,
    expect,
    getAdminClient,
    getRandomId,
    hasEnterpriseLicense,
    test,
    testConfig,
    duration,
} from '@mattermost/playwright-lib';

import {
    type CpaFieldsMap,
    deleteCustomProfileAttributes,
    getFieldIdByName,
    setupCustomProfileAttributeFields,
    verifyAttributeInPopover,
} from '../custom_profile_attributes/helpers';

const suffix = getRandomId();
const TEXT_NAME = `bot_team_${suffix}`;
const SELECT_NAME = `bot_tier_${suffix}`;
const ADMIN_MANAGED_NAME = `bot_clearance_${suffix}`;
const TEXT_LABEL = `Bot Team ${suffix}`;
const SELECT_LABEL = `Bot Tier ${suffix}`;
const GOLD = `Gold ${suffix}`;
const SILVER = `Silver ${suffix}`;

let fields: CpaFieldsMap | undefined;
let textField: UserPropertyField;
let selectField: UserPropertyField;
let adminManagedField: UserPropertyField;

function requireFields(): CpaFieldsMap {
    if (!fields) {
        throw new Error('The attribute fields were not set up');
    }
    return fields;
}

function botsPath(app: App, teamName: string): string {
    return `${app.integrationsPage.pathFor({team: {name: teamName}})}/bots`;
}

function optionId(field: UserPropertyField, name: string): string {
    const option = field.attrs?.options?.find((o) => o.name === name);
    if (!option) {
        throw new Error(`Option ${name} not found on field ${field.name}`);
    }
    return option.id;
}

function botUsername(prefix: string): string {
    return `${prefix}${getRandomId(8)}`;
}

async function openBotEdit(app: App, teamName: string, bot: {user_id: string; username: string}) {
    await app.page.goto(botsPath(app, teamName));
    await app.integrations.bots.searchSearchbox.fill(bot.username);
    await expect(app.integrations.bots.searchSearchbox).toHaveValue(bot.username);
    await expect(app.integrations.bots.bot(bot).container).toBeVisible();
    await app.integrations.bots.bot(bot).editLink.click();
    await expect(app.page).toHavePath(`${botsPath(app, teamName)}/edit`);
    await expect(app.integrations.botForm.attributes.addButton).toBeEnabled();
}

async function seedBot(adminClient: Client4, values: Record<string, string>) {
    const bot = await adminClient.createBot({username: botUsername('battr'), display_name: `Attr bot ${suffix}`});
    await adminClient.updateUserCustomProfileAttributesValues(bot.user_id, values);
    expect(await adminClient.getUserCustomProfileAttributesValues(bot.user_id)).toMatchObject(values);
    return bot;
}

// A partial save failure keeps the edit page open with an error: the path wait then reports the path it stayed on.
async function saveBotEdit(app: App, teamName: string) {
    const form = app.integrations.botForm;
    await form.saveButton.click();
    await expect(app.page).toHavePath(botsPath(app, teamName), {timeout: duration.one_min});
    await expect(form.errorText).toBeHidden();
}

test.describe('Bot account attributes @bot_accounts', () => {
    test.beforeAll(async () => {
        const {adminClient} = await getAdminClient();
        if (!adminClient) {
            throw new Error('Admin client is not available');
        }

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.IsLicensed !== 'true' || !hasEnterpriseLicense(license.SkuShortName),
            'Bot attributes require an Enterprise license',
        );

        await adminClient.patchConfig({
            ServiceSettings: {EnableBotAccountCreation: true, EnableUserAccessTokens: true},
        });
        await expect
            .poll(async () => {
                const cfg = await adminClient.getConfig();
                return (
                    cfg.ServiceSettings?.EnableBotAccountCreation === true &&
                    cfg.ServiceSettings?.EnableUserAccessTokens === true
                );
            })
            .toBe(true);

        fields = await setupCustomProfileAttributeFields(adminClient, [
            {name: TEXT_NAME, type: 'text', attrs: {display_name: TEXT_LABEL}},
            {
                name: SELECT_NAME,
                type: 'select',
                options: [
                    {name: GOLD, color: '#FFD700'},
                    {name: SILVER, color: '#C0C0C0'},
                ],
                attrs: {display_name: SELECT_LABEL},
            },
            {
                name: ADMIN_MANAGED_NAME,
                type: 'text',
                attrs: {display_name: `Bot Clearance ${suffix}`, managed: 'admin'},
            },
        ]);

        // The helper swallows create errors (e.g. the per-group field cap), so assert creation explicitly.
        expect(fields.ownedIds.size).toBe(3);
        textField = fields[getFieldIdByName(fields, TEXT_NAME)];
        selectField = fields[getFieldIdByName(fields, SELECT_NAME)];
        adminManagedField = fields[getFieldIdByName(fields, ADMIN_MANAGED_NAME)];
        expect(textField.type).toBe('text');
        expect(selectField.type).toBe('select');
        expect(selectField.attrs?.options?.length).toBe(2);
        expect(adminManagedField.attrs?.managed).toBe('admin');
    });

    test.afterAll(async () => {
        if (!fields) {
            return;
        }
        const {adminClient} = await getAdminClient();
        if (adminClient) {
            await deleteCustomProfileAttributes(adminClient, fields);
        }
    });

    /**
     * @objective Verify a system admin can add a text and a select attribute while creating a bot, and the values persist.
     */
    test('creates a bot with text and select attributes', {tag: '@bot_accounts'}, async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {adminUser, adminClient, team, townSquare} = await pw.initSetup();
        const textValue = `Platform ${suffix}`;

        // # Log in as admin and open the Add Bot page
        const {app, page} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: townSquare});
        await page.goto(`${botsPath(app, team.name)}/add`);
        const form = app.integrations.botForm;
        await form.usernameTextbox.fill(botUsername('battr'));

        // * The attributes section is ready
        const attributes = form.attributes;
        await expect(attributes).toBeVisible();
        await expect(attributes.addButton).toBeEnabled();

        // # Add the text attribute and enter a value
        await attributes.addButton.click();
        await expect(attributes.addMenu.container).toBeVisible();
        const addMenu = attributes.addMenu;
        await addMenu.field(textField).click();
        await expect(attributes.attribute(textField).valueInputTextbox).toBeVisible();
        await attributes.attribute(textField).valueInputTextbox.fill(textValue);

        // # Add the select attribute and pick an option
        await attributes.addButton.click();
        await expect(attributes.addMenu.container).toBeVisible();
        await addMenu.field(selectField).click();
        await expect(attributes.attribute(selectField).valueChoiceCombobox).toBeVisible();
        await attributes.attribute(selectField).valueChoiceCombobox.choose(GOLD);
        await expect(attributes.attribute(selectField).valueChoiceCombobox).toHaveValue(GOLD);

        // * Added fields are no longer offered in the add menu
        await attributes.addButton.click();
        await expect(attributes.addMenu.container).toBeVisible();
        await expect(addMenu.manageMenuItem).toBeVisible();
        await expect(addMenu.field(textField)).toHaveCount(0);
        await expect(addMenu.field(selectField)).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(addMenu.manageMenuItem).toBeHidden();

        // # Create the bot
        await form.saveButton.click();
        await expect(page).toHavePath(`${app.integrationsPage.pathFor({team})}/confirm`, {timeout: duration.half_min});

        // * The confirmation page shows the token and no partial-failure warnings
        const confirmUrl = new URL(page.url());
        expect(confirmUrl.searchParams.get('type')).toBe('bots');
        expect(confirmUrl.searchParams.get('bot_warnings')).toBeNull();
        await expect(app.integrations.confirm.copyTokenButton).toBeVisible();
        await expect(app.integrations.botCreateWarnings).toBeHidden();

        // * The attribute values were saved on the bot user
        const botUserId = confirmUrl.searchParams.get('id');
        expect(botUserId).toBeTruthy();
        await expect
            .poll(() => adminClient.getUserCustomProfileAttributesValues(botUserId as string))
            .toMatchObject({[textField.id]: textValue, [selectField.id]: optionId(selectField, GOLD)});
    });

    /**
     * @objective Verify editing a bot changes an existing attribute value.
     */
    test('edits a bot attribute value', {tag: '@bot_accounts'}, async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {adminUser, adminClient, team} = await pw.initSetup();
        const initialValue = `Initial ${suffix}`;
        const updatedValue = `Updated ${suffix}`;

        // # Seed a bot with attribute values and open its edit page
        const bot = await seedBot(adminClient, {
            [textField.id]: initialValue,
            [selectField.id]: optionId(selectField, GOLD),
        });
        const {app} = await pw.testBrowser.login(adminUser);
        await openBotEdit(app, team.name, bot);

        // * Existing values are pre-filled
        const attributes = app.integrations.botForm.attributes;
        const textInput = attributes.attribute(textField).valueInputTextbox;
        const select = attributes.attribute(selectField).valueChoiceCombobox;
        await expect(textInput).toHaveValue(initialValue);
        await expect(select).toHaveValue(GOLD);

        // # Change both values and save
        await textInput.fill(updatedValue);
        await select.choose(SILVER);
        await expect(select).toHaveValue(SILVER);
        await saveBotEdit(app, team.name);

        // * The save returns to the bots list, which still lists the bot
        await expect(app.integrations.bots.bot(bot)).toBeVisible();

        // * The new values were saved
        await expect
            .poll(() => adminClient.getUserCustomProfileAttributesValues(bot.user_id))
            .toMatchObject({[textField.id]: updatedValue, [selectField.id]: optionId(selectField, SILVER)});
    });

    /**
     * @objective Verify a non-admin bot owner with manage_bots can edit their bot's attributes, but not admin-managed ones.
     */
    test(
        'lets a non-admin bot owner edit attributes except admin-managed ones',
        {tag: '@bot_accounts'},
        async ({pw}) => {
            test.setTimeout(duration.two_min);
            const {user, userClient, adminClient, team} = await pw.initSetup();
            const initialValue = `Owner initial ${suffix}`;
            const updatedValue = `Owner updated ${suffix}`;

            // # Make only this user a bot manager, then give them a bot seeded with a text value
            // There is no API to create a role, so borrow a built-in one whose defaults are a subset of system_user.
            // read_bots is what lets the Bots list show the user's own bots.
            const botManagerRole = await adminClient.getRoleByName('system_custom_group_admin');
            await adminClient.patchRole(botManagerRole.id, {
                permissions: [...new Set([...botManagerRole.permissions, 'read_bots', 'manage_bots'])],
            });
            await adminClient.updateUserRoles(user.id, `system_user ${botManagerRole.name}`);
            const bot = await seedBot(adminClient, {[textField.id]: initialValue});
            await adminClient.assignBot(bot.user_id, user.id);

            // # Log in as the owner and open the bot's edit page
            const {app} = await pw.testBrowser.login(user);
            await openBotEdit(app, team.name, bot);

            // # Change the existing text value
            const attributes = app.integrations.botForm.attributes;
            const textInput = attributes.attribute(textField).valueInputTextbox;
            await expect(textInput).toHaveValue(initialValue);
            await textInput.fill(updatedValue);

            // * The add menu offers the select field but not the admin-managed field or the admin-only manage link
            await attributes.addButton.click();
            await expect(attributes.addMenu.container).toBeVisible();
            const addMenu = attributes.addMenu;
            await expect(addMenu.field(selectField)).toBeVisible();
            await expect(addMenu.field(adminManagedField)).toHaveCount(0);
            await expect(addMenu.manageMenuItem).toHaveCount(0);

            // # Add the select attribute, pick an option, and save
            await addMenu.field(selectField).click();
            await expect(attributes.attribute(selectField).valueChoiceCombobox).toBeVisible();
            await attributes.attribute(selectField).valueChoiceCombobox.choose(GOLD);
            await expect(attributes.attribute(selectField).valueChoiceCombobox).toHaveValue(GOLD);
            await saveBotEdit(app, team.name);

            // * The owner's changes were saved and the admin-managed field was left unset
            await expect
                .poll(async () => {
                    const values = await adminClient.getUserCustomProfileAttributesValues(bot.user_id);
                    return {
                        text: values[textField.id],
                        select: values[selectField.id],
                        adminManaged: values[adminManagedField.id] ?? '',
                    };
                })
                .toEqual({text: updatedValue, select: optionId(selectField, GOLD), adminManaged: ''});

            // * The server rejects the owner writing the admin-managed field directly
            await expect(
                userClient.updateUserCustomProfileAttributesValues(bot.user_id, {[adminManagedField.id]: 'Top secret'}),
            ).rejects.toMatchObject({status_code: 403});
        },
    );

    /**
     * @objective Verify removing an attribute row from a bot clears that value and leaves the others intact.
     */
    test('removes a bot attribute and clears its value', {tag: '@bot_accounts'}, async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {adminUser, adminClient, team} = await pw.initSetup();

        // # Seed a bot with attribute values and open its edit page
        const bot = await seedBot(adminClient, {
            [textField.id]: `Remove me ${suffix}`,
            [selectField.id]: optionId(selectField, GOLD),
        });
        const {app} = await pw.testBrowser.login(adminUser);
        await openBotEdit(app, team.name, bot);

        // # Remove the text attribute row
        const attributes = app.integrations.botForm.attributes;
        await attributes.attribute(textField).removeButton.click();

        // * The text row is gone, the select row remains, and focus moves to the add button
        await expect(attributes.attribute(textField)).toHaveCount(0);
        await expect(attributes.attribute(selectField)).toBeVisible();
        await expect(attributes.addButton).toBeFocused();

        // # Save the bot
        await saveBotEdit(app, team.name);

        // * The text value is cleared and the select value is unchanged
        await expect
            .poll(async () => {
                const values = await adminClient.getUserCustomProfileAttributesValues(bot.user_id);
                return {text: values[textField.id] ?? '', select: values[selectField.id]};
            })
            .toEqual({text: '', select: optionId(selectField, GOLD)});

        // * Reopening the bot shows only the select row
        await openBotEdit(app, team.name, bot);
        await expect(attributes.attribute(textField)).toHaveCount(0);
        await expect(attributes.attribute(selectField)).toBeVisible();
    });

    /**
     * @objective Verify a bot's attributes appear in its profile popover when it posts in a channel.
     */
    test('shows bot attributes in the bot profile popover', {tag: '@bot_accounts'}, async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {adminUser, adminClient, team} = await pw.initSetup();
        const textValue = `Popover ${suffix}`;
        const message = `Bot attributes ${suffix}`;

        // # Seed a bot with attribute values and add it to a new channel
        const bot = await seedBot(adminClient, {
            [textField.id]: textValue,
            [selectField.id]: optionId(selectField, SILVER),
        });
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `bot-attr-${suffix}-${getRandomId(4)}`,
            display_name: `Bot attr ${suffix}`,
            type: 'O',
        });
        await adminClient.addToTeam(team.id, bot.user_id);
        await adminClient.addToChannel(bot.user_id, channel.id);

        // # Post in the channel as the bot
        const {token} = await adminClient.createUserAccessToken(bot.user_id, 'bot attributes e2e');
        if (!token) {
            throw new Error('Expected a token secret from createUserAccessToken');
        }
        const botClient = new Client4();
        botClient.setUrl(testConfig.baseURL);
        botClient.setToken(token);
        const botPost = await botClient.createPost({channel_id: channel.id, message});

        // # Log in as admin and open the channel
        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel});

        // * The bot's post shows
        const post = app.center.postList.post(botPost);
        await expect(post.message.container).toContainText(message);

        // # Open the bot's profile popover
        // ProfilePicture exposes a role-free container, so the popover trigger has no click driver.
        await post.avatar.container.click();

        // * The popover belongs to the bot and shows both attributes with their values
        await expect(app.profilePopover.usernameText).toContainText(`@${bot.username}`);
        await verifyAttributeInPopover(app, requireFields(), TEXT_NAME, textValue);
        await verifyAttributeInPopover(app, requireFields(), SELECT_NAME, SILVER);
    });

    /**
     * @objective Verify Enter on a closed select attribute neither submits the Add Bot form nor opens the Add attribute menu, and Create still saves the picked value.
     */
    test(
        'Enter on a closed select attribute does not create the bot or open the add menu',
        {tag: '@bot_accounts'},
        async ({pw}) => {
            test.setTimeout(duration.two_min);
            const {adminUser, adminClient, team} = await pw.initSetup();
            const username = botUsername('benter');
            const displayName = `Enter bot ${suffix}`;

            // # Log in as admin and record every create-bot request the page sends
            const {app, page} = await pw.testBrowser.login(adminUser);
            const createBotRequests: string[] = [];
            page.on('request', (request) => {
                if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/v4/bots')) {
                    createBotRequests.push(request.url());
                }
            });

            // # Open the Add Bot page, enter a username and add the select attribute
            await app.channelsPage.goto({team, channel: 'town-square'});
            const addPath = `${botsPath(app, team.name)}/add`;
            await page.goto(addPath);
            const form = app.integrations.botForm;
            await form.usernameTextbox.fill(username);
            const attributes = form.attributes;
            await expect(attributes.addButton).toBeEnabled();
            await attributes.addButton.click();
            await expect(attributes.addMenu.container).toBeVisible();
            const addMenu = attributes.addMenu;
            await addMenu.field(selectField).click();
            await expect(addMenu.manageMenuItem).toBeHidden();
            const select = attributes.attribute(selectField);
            const combobox = select.valueChoiceCombobox.locator;

            // * The select is a combobox named after the field
            await expect(combobox).toHaveAccessibleName(SELECT_LABEL);
            await expect(combobox).toHaveAttribute(
                'id',
                `integrations.bot_form.attributes.attribute-combobox-${selectField.id}`,
            );

            // # Focus the empty select and press Enter
            await combobox.focus();
            await expect(combobox).toHaveAttribute('aria-expanded', 'false');
            await combobox.press('Enter');

            // * The page stays on Add Bot, sends no create request, and the Add attribute menu stays closed
            // Unguarded Enter opens this menu today; the no-create checks only bite once its trigger is type="button".
            await expect(page).toHavePath(addPath);
            expect(createBotRequests).toHaveLength(0);
            await expect(attributes.addButton).toHaveAttribute('aria-expanded', 'false');
            await expect(addMenu.manageMenuItem).toBeHidden();
            await expect(combobox).toBeFocused();

            // # Pick Gold, then press Enter on the closed select again
            await select.valueChoiceCombobox.choose(GOLD);
            await expect(select.valueChoiceCombobox).toHaveValue(GOLD);
            await expect(combobox).toBeFocused();
            await combobox.press('Enter');

            // * Still on Add Bot with Gold kept, no create request, no add menu, and no such user on the server
            await expect(page).toHavePath(addPath);
            await expect(combobox).toHaveValue(GOLD);
            await expect(combobox).toHaveAttribute('aria-expanded', 'false');
            expect(createBotRequests).toHaveLength(0);
            await expect(attributes.addButton).toHaveAttribute('aria-expanded', 'false');
            await expect(addMenu.manageMenuItem).toBeHidden();
            await expect(combobox).toBeFocused();
            await expect(adminClient.getUserByUsername(username)).rejects.toMatchObject({status_code: 404});

            // # Set a display name, then click Create
            await form.displayNameTextbox.fill(displayName);
            await form.saveButton.click();

            // * The form submits once and the bot has the display name and the select value
            await expect(page).toHavePath(`${app.integrationsPage.pathFor({team})}/confirm`, {
                timeout: duration.half_min,
            });
            expect(createBotRequests).toHaveLength(1);
            const confirmUrl = new URL(page.url());
            expect(confirmUrl.searchParams.get('type')).toBe('bots');
            const botUserId = confirmUrl.searchParams.get('id');
            expect(botUserId).toBeTruthy();
            expect((await adminClient.getBot(botUserId as string)).display_name).toBe(displayName);
            await expect
                .poll(() => adminClient.getUserCustomProfileAttributesValues(botUserId as string))
                .toMatchObject({[selectField.id]: optionId(selectField, GOLD)});
        },
    );

    test.describe('rank attribute', () => {
        const RANK_LABEL = `Bot Level ${suffix}`;
        let rankField: UserPropertyField | undefined;

        test.beforeAll(async () => {
            const {adminClient} = await getAdminClient();
            rankField = await adminClient.createCustomProfileAttributeField({
                name: `bot_level_${suffix}`,
                type: 'rank',
                attrs: {
                    sort_order: 3,
                    visibility: 'always',
                    display_name: RANK_LABEL,
                    options: [
                        {name: 'Low', rank: 1},
                        {name: 'High', rank: 2},
                    ],
                },
            } as any);
        });

        test.afterAll(async () => {
            if (!rankField) {
                return;
            }
            const {adminClient} = await getAdminClient();
            await deleteCustomProfileAttributes(adminClient, {[rankField.id]: rankField});
        });

        /**
         * @objective Verify a rank attribute on a bot edits like the other dropdown attributes: it shows the assigned value with its badge, and both picking another value and clearing it persist.
         */
        test('edits and clears a rank attribute on a bot', {tag: '@bot_accounts'}, async ({pw}) => {
            test.setTimeout(duration.two_min);
            if (!rankField) {
                throw new Error('The rank field was not created');
            }
            const field = rankField;
            const {adminUser, adminClient, team} = await pw.initSetup();

            // # Seed a bot with the lowest rank and open its edit page
            const bot = await seedBot(adminClient, {[field.id]: optionId(field, 'Low')});
            const {app} = await pw.testBrowser.login(adminUser);
            await openBotEdit(app, team.name, bot);
            const attribute = app.integrations.botForm.attributes.attribute(field);
            const rank = attribute.valueChoiceCombobox.locator;
            const badge = attribute.badgeText.locator;

            // * The rank is a combobox named after the field, showing the assigned value with its badge,
            //   and its rank is announced as the field's description
            await expect(rank).toHaveAccessibleName(RANK_LABEL);
            await expect(rank).toHaveValue('Low');
            await expect(badge).toHaveText('1');
            await expect(rank).toHaveAccessibleDescription('Rank 1');

            // # Open the listbox
            await rank.click();
            await expect(rank).toHaveAttribute('aria-expanded', 'true');

            // * Values are listed highest-rank-first, each named with its rank, and the assigned value is selected
            await expect(attribute.choiceList.locator).toHaveText([/^2\s*High$/, /^1\s*Low$/]);
            await expect(attribute.choice({id: optionId(field, 'High')})).toHaveAccessibleName('High, Rank 2');
            await expect(attribute.choice({id: optionId(field, 'Low')})).toHaveAttribute('aria-selected', 'true');

            // # Close the listbox
            await rank.press('Escape');
            await expect(rank).toHaveAttribute('aria-expanded', 'false');

            // # Pick the higher rank and save
            await attribute.valueChoiceCombobox.choose(/^High,/);
            await expect(attribute.valueChoiceCombobox).toHaveValue('High');
            await expect(badge).toHaveText('2');
            await saveBotEdit(app, team.name);

            // * The new value was saved
            await expect
                .poll(() => adminClient.getUserCustomProfileAttributesValues(bot.user_id))
                .toMatchObject({[field.id]: optionId(field, 'High')});

            // # Reopen the bot and clear the rank
            await openBotEdit(app, team.name, bot);
            await expect(rank).toHaveValue('High');
            await attribute.clearButton.click();

            // * The input is empty
            await expect(rank).toHaveValue('');

            // # Save the bot
            await saveBotEdit(app, team.name);

            // * The value was cleared
            await expect
                .poll(async () => (await adminClient.getUserCustomProfileAttributesValues(bot.user_id))[field.id] ?? '')
                .toBe('');
        });
    });
});
