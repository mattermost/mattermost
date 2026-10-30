// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {expect, getAdminClient, getRandomId, hasEnterpriseLicense, test, testConfig} from '@mattermost/playwright-lib';

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

async function dismissWebpackOverlay(page: Page) {
    await page
        .locator('#webpack-dev-server-client-overlay')
        .evaluateAll((nodes) => {
            nodes.forEach((node) => node.remove());
        })
        .catch(() => null);
}

function botAttributeCombobox(page: Page, fieldId: string) {
    return page.getByTestId(`bot-attribute-label-${fieldId}`).getByRole('combobox');
}

// Focus alone doesn't open the menu, so click and wait for it; the listbox is portaled to the page.
async function pickBotAttributeOption(page: Page, fieldId: string, optionName: string) {
    const combobox = botAttributeCombobox(page, fieldId);
    await combobox.click();
    await expect(combobox).toHaveAttribute('aria-expanded', 'true');
    const listboxId = await combobox.getAttribute('aria-controls');
    if (!listboxId) {
        throw new Error(`Bot attribute combobox ${fieldId} has no aria-controls`);
    }
    await page.locator(`#${listboxId}`).getByRole('option', {name: optionName, exact: true}).click();
    await expect(combobox).toHaveAttribute('aria-expanded', 'false');
}

async function openBotEdit(page: Page, teamName: string, username: string) {
    await page.goto(`/${teamName}/integrations/bots`);
    await dismissWebpackOverlay(page);
    await page.locator('#searchInput').fill(username);
    const botItem = page.locator('.backstage-list__item', {hasText: `@${username}`});
    await expect(botItem).toBeVisible();
    await botItem.getByRole('link', {name: 'Edit'}).click();
    await page.waitForURL(/\/integrations\/bots\/edit\?id=/);
    await expect(page.getByTestId('botAttributesAddButton')).toBeEnabled();
}

async function seedBot(adminClient: Client4, values: Record<string, string>) {
    const bot = await adminClient.createBot({username: botUsername('battr'), display_name: `Attr bot ${suffix}`});
    await adminClient.updateUserCustomProfileAttributesValues(bot.user_id, values);
    expect(await adminClient.getUserCustomProfileAttributesValues(bot.user_id)).toMatchObject(values);
    return bot;
}

// A partial save failure keeps the edit page open with an error, so fail fast with its text instead of a URL timeout.
async function saveBotEdit(page: Page, teamName: string) {
    const saveError = page.locator('.backstage-form__footer .has-error');
    await page.locator('#saveBot').click();
    const saved = page.waitForURL(new RegExp(`/${teamName}/integrations/bots$`)).then(() => 'saved' as const);
    const failed = saveError.waitFor({state: 'visible'}).then(
        () => 'error' as const,
        () => new Promise<never>(() => {}),
    );
    if ((await Promise.race([saved, failed])) === 'error') {
        throw new Error(`Saving the bot failed: ${await saveError.innerText()}`);
    }
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
        test.setTimeout(120000);
        const {adminUser, adminClient, team} = await pw.initSetup();
        const textValue = `Platform ${suffix}`;

        // # Log in as admin and open the Add Bot page
        const {channelsPage, page} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();
        await page.goto(`/${team.name}/integrations/bots/add`);
        await dismissWebpackOverlay(page);
        await page.locator('#username').fill(botUsername('battr'));

        // * The attributes section is ready
        await expect(page.getByTestId('botAttributesSection')).toBeVisible();
        const addButton = page.getByTestId('botAttributesAddButton');
        await expect(addButton).toBeEnabled();

        // # Add the text attribute and enter a value
        await addButton.click();
        await page.getByTestId(`botAttributesAdd-${textField.id}`).click();
        const textRow = page.getByTestId(`bot-attribute-label-${textField.id}`);
        await textRow.locator('input').fill(textValue);

        // # Add the select attribute and pick an option
        await addButton.click();
        await page.getByTestId(`botAttributesAdd-${selectField.id}`).click();
        await pickBotAttributeOption(page, selectField.id, GOLD);

        // * Added fields are no longer offered in the add menu
        await addButton.click();
        await expect(page.getByRole('menu', {name: 'Add attribute'})).toBeVisible();
        await expect(page.getByTestId(`botAttributesAdd-${textField.id}`)).toHaveCount(0);
        await expect(page.getByTestId(`botAttributesAdd-${selectField.id}`)).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('menu', {name: 'Add attribute'})).toBeHidden();

        // # Create the bot
        await page.locator('#saveBot').click();
        await page.waitForURL(/\/integrations\/confirm\?type=bots/);

        // * The confirmation page shows the token and no partial-failure warnings
        const confirmUrl = new URL(page.url());
        expect(confirmUrl.searchParams.get('bot_warnings')).toBeNull();
        await expect(page.locator('#botCreateWarnings')).toBeHidden();
        await expect(page.getByText('Token:')).toBeVisible();

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
        test.setTimeout(120000);
        const {adminUser, adminClient, team} = await pw.initSetup();
        const initialValue = `Initial ${suffix}`;
        const updatedValue = `Updated ${suffix}`;

        // # Seed a bot with attribute values and open its edit page
        const bot = await seedBot(adminClient, {
            [textField.id]: initialValue,
            [selectField.id]: optionId(selectField, GOLD),
        });
        const {page} = await pw.testBrowser.login(adminUser);
        await openBotEdit(page, team.name, bot.username);

        // * Existing values are pre-filled
        const textInput = page.getByTestId(`bot-attribute-label-${textField.id}`).locator('input');
        const select = botAttributeCombobox(page, selectField.id);
        await expect(textInput).toHaveValue(initialValue);
        await expect(select).toHaveValue(GOLD);

        // # Change both values and save
        await textInput.fill(updatedValue);
        await pickBotAttributeOption(page, selectField.id, SILVER);
        await saveBotEdit(page, team.name);

        // * The save returns to the bots list, which still lists the bot
        await page.locator('#searchInput').fill(bot.username);
        await expect(page.locator('.backstage-list__item', {hasText: `@${bot.username}`})).toBeVisible();

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
            test.setTimeout(120000);
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
            const {page} = await pw.testBrowser.login(user);
            await openBotEdit(page, team.name, bot.username);

            // # Change the existing text value
            const textInput = page.getByTestId(`bot-attribute-label-${textField.id}`).locator('input');
            await expect(textInput).toHaveValue(initialValue);
            await textInput.fill(updatedValue);

            // * The add menu offers the select field but not the admin-managed field or the admin-only manage link
            await page.getByTestId('botAttributesAddButton').click();
            await expect(page.getByRole('menu', {name: 'Add attribute'})).toBeVisible();
            await expect(page.getByTestId(`botAttributesAdd-${selectField.id}`)).toBeVisible();
            await expect(page.getByTestId(`botAttributesAdd-${adminManagedField.id}`)).toHaveCount(0);
            await expect(page.getByTestId('botAttributesManage')).toHaveCount(0);

            // # Add the select attribute, pick an option, and save
            await page.getByTestId(`botAttributesAdd-${selectField.id}`).click();
            await pickBotAttributeOption(page, selectField.id, GOLD);
            await saveBotEdit(page, team.name);

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
        test.setTimeout(120000);
        const {adminUser, adminClient, team} = await pw.initSetup();

        // # Seed a bot with attribute values and open its edit page
        const bot = await seedBot(adminClient, {
            [textField.id]: `Remove me ${suffix}`,
            [selectField.id]: optionId(selectField, GOLD),
        });
        const {page} = await pw.testBrowser.login(adminUser);
        await openBotEdit(page, team.name, bot.username);

        // # Remove the text attribute row
        await page.getByTestId(`bot-attribute-remove-${textField.id}`).click();

        // * The text row is gone, the select row remains, and focus moves to the add button
        await expect(page.getByTestId(`bot-attribute-label-${textField.id}`)).toHaveCount(0);
        await expect(page.getByTestId(`bot-attribute-label-${selectField.id}`)).toBeVisible();
        await expect(page.getByTestId('botAttributesAddButton')).toBeFocused();

        // # Save the bot
        await saveBotEdit(page, team.name);

        // * The text value is cleared and the select value is unchanged
        await expect
            .poll(async () => {
                const values = await adminClient.getUserCustomProfileAttributesValues(bot.user_id);
                return {text: values[textField.id] ?? '', select: values[selectField.id]};
            })
            .toEqual({text: '', select: optionId(selectField, GOLD)});

        // * Reopening the bot shows only the select row
        await openBotEdit(page, team.name, bot.username);
        await expect(page.getByTestId(`bot-attribute-label-${textField.id}`)).toHaveCount(0);
        await expect(page.getByTestId(`bot-attribute-label-${selectField.id}`)).toBeVisible();
    });

    /**
     * @objective Verify a bot's attributes appear in its profile popover when it posts in a channel.
     */
    test('shows bot attributes in the bot profile popover', {tag: '@bot_accounts'}, async ({pw}) => {
        test.setTimeout(120000);
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
        await botClient.createPost({channel_id: channel.id, message});

        // # Log in as admin and open the channel
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * The bot's post is the last post
        const post = await channelsPage.getLastPost();
        await post.toContainText(message);

        // # Open the bot's profile popover
        await channelsPage.openProfilePopover(post);

        // * The popover belongs to the bot and shows both attributes with their values
        await expect(channelsPage.userProfilePopover.container).toContainText(`@${bot.username}`);
        await verifyAttributeInPopover(channelsPage, TEXT_LABEL, textValue);
        await verifyAttributeInPopover(channelsPage, SELECT_LABEL, SILVER);
    });

    /**
     * @objective Verify Enter on a closed select attribute neither submits the Add Bot form nor opens the Add attribute menu, and Create still saves the picked value.
     */
    test(
        'Enter on a closed select attribute does not create the bot or open the add menu',
        {tag: '@bot_accounts'},
        async ({pw}) => {
            test.setTimeout(120000);
            const {adminUser, adminClient, team} = await pw.initSetup();
            const username = botUsername('benter');
            const displayName = `Enter bot ${suffix}`;
            const addPath = `/${team.name}/integrations/bots/add`;

            // # Log in as admin and record every create-bot request the page sends
            const {channelsPage, page} = await pw.testBrowser.login(adminUser);
            const createBotRequests: string[] = [];
            page.on('request', (request) => {
                if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/v4/bots')) {
                    createBotRequests.push(request.url());
                }
            });

            // # Open the Add Bot page, enter a username and add the select attribute
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();
            await page.goto(addPath);
            await dismissWebpackOverlay(page);
            await page.locator('#username').fill(username);
            const addButton = page.getByTestId('botAttributesAddButton');
            const addMenu = page.getByRole('menu', {name: 'Add attribute'});
            await expect(addButton).toBeEnabled();
            await addButton.click();
            await page.getByTestId(`botAttributesAdd-${selectField.id}`).click();
            await expect(addMenu).toBeHidden();
            const combobox = botAttributeCombobox(page, selectField.id);

            // * The select is a combobox named after the field
            await expect(combobox).toHaveAccessibleName(SELECT_LABEL);
            await expect(combobox).toHaveAttribute('id', `bot-attribute-combobox-${selectField.id}`);

            // # Focus the empty select and press Enter
            await combobox.focus();
            await expect(combobox).toHaveAttribute('aria-expanded', 'false');
            await combobox.press('Enter');

            // * The page stays on Add Bot, sends no create request, and the Add attribute menu stays closed
            // Unguarded Enter opens this menu today; the no-create checks only bite once its trigger is type="button".
            await expect(page).toHavePath(addPath);
            expect(createBotRequests).toHaveLength(0);
            await expect(addButton).toHaveAttribute('aria-expanded', 'false');
            await expect(addMenu).toBeHidden();
            await expect(combobox).toBeFocused();

            // # Pick Gold, then press Enter on the closed select again
            await pickBotAttributeOption(page, selectField.id, GOLD);
            await expect(combobox).toBeFocused();
            await combobox.press('Enter');

            // * Still on Add Bot with Gold kept, no create request, no add menu, and no such user on the server
            await expect(page).toHavePath(addPath);
            await expect(combobox).toHaveValue(GOLD);
            await expect(combobox).toHaveAttribute('aria-expanded', 'false');
            expect(createBotRequests).toHaveLength(0);
            await expect(addButton).toHaveAttribute('aria-expanded', 'false');
            await expect(addMenu).toBeHidden();
            await expect(combobox).toBeFocused();
            await expect(adminClient.getUserByUsername(username)).rejects.toMatchObject({status_code: 404});

            // # Set a display name, then click Create
            await page.locator('#displayName').fill(displayName);
            await page.locator('#saveBot').click();

            // * The form submits once and the bot has the display name and the select value
            await page.waitForURL(/\/integrations\/confirm\?type=bots/);
            expect(createBotRequests).toHaveLength(1);
            const botUserId = new URL(page.url()).searchParams.get('id');
            expect(botUserId).toBeTruthy();
            expect((await adminClient.getBot(botUserId as string)).display_name).toBe(displayName);
            await expect
                .poll(() => adminClient.getUserCustomProfileAttributesValues(botUserId as string))
                .toMatchObject({[selectField.id]: optionId(selectField, GOLD)});
        },
    );
});
