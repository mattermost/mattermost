// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import {
    attributeName,
    createAttribute,
    deleteAttributes,
    optionId,
    purgeAttributes,
    readChannelValues,
    valueFor,
} from '../channel_attributes/helpers';
import {
    REQUIRED_FIELD_TEST_TIMEOUT,
    expectMissingRequiredRefusal,
} from '../channel_attributes/missing_required_helpers';

const OPTIONS = ['AURORA', 'ZEPHYR'];

async function setUpGroupMessage(pw: PlaywrightExtended, suffix: string) {
    // A regular user owns the conversation: the admin is on hundreds of teams on a shared dev
    // database, so its first page load outlasts the default expect timeout.
    const {adminClient, user, team} = await pw.initSetup();
    const {client: userClient} = await pw.makeClient(user);
    const [first, second] = await adminClient.createUsers(team.id, 2, 'gm-required');
    const groupMessage = await userClient.createGroupChannel([user.id, first.id, second.id]);

    return {adminClient, user, userClient, team, groupMessage, name: `convert-gm-${suffix}`};
}

test.describe('Convert group message - required channel attributes', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify converting a group message asks for the required attribute, keeps the convert button
     * disabled until a value is picked, and leaves a private channel that carries the value.
     */
    test('asks for the required value and converts with it', async ({pw}) => {
        test.setTimeout(REQUIRED_FIELD_TEST_TIMEOUT);
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const suffix = pw.random.id();
        const created: PropertyField[] = [];
        const {adminClient, user, team, groupMessage} = await setUpGroupMessage(pw, suffix);

        try {
            await purgeAttributes(adminClient);
            const field = await createAttribute(adminClient, attributeName('convert_gm', suffix), {
                type: 'select',
                options: OPTIONS,
                required: true,
            });
            created.push(field);

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.gotoMessage(team.name, groupMessage.name);
            await channelsPage.toBeVisible();

            // # Open Convert to Private Channel
            const modal = await channelsPage.openConvertGmModal();

            // * The required attribute is asked for
            await expect(modal.attributes.row(field.name)).toBeVisible();

            // # Name the channel
            await modal.fillName(`Convert GM ${suffix}`);

            // * The convert button stays disabled until the value is filled
            await expect(modal.confirmButton).toBeDisabled();

            // # Pick a value
            await modal.attributes.select(field.name, 'AURORA');
            await expect(modal.confirmButton).toBeEnabled();

            // # Convert
            await modal.confirm();

            // * The group message is now a private channel carrying the value
            await expect.poll(async () => (await adminClient.getChannel(groupMessage.id)).type).toBe('P');
            expect(valueFor(await readChannelValues(adminClient, groupMessage.id), field)).toBe(
                optionId(field, 'AURORA'),
            );
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify converting a group message through the API without the required value is refused
     * with a 400 and leaves the conversation a group message.
     */
    test('refuses an API conversion without the required value', async ({pw}) => {
        test.setTimeout(REQUIRED_FIELD_TEST_TIMEOUT);
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const suffix = pw.random.id();
        const created: PropertyField[] = [];
        const {adminClient, userClient, team, groupMessage, name} = await setUpGroupMessage(pw, suffix);

        try {
            await purgeAttributes(adminClient);
            created.push(
                await createAttribute(adminClient, attributeName('convert_gm_api', suffix), {
                    type: 'select',
                    options: OPTIONS,
                    required: true,
                }),
            );

            // * The server refuses the conversion without a value
            await expectMissingRequiredRefusal(() =>
                userClient.convertGroupMessageToPrivateChannel(groupMessage.id, team.id, `Convert GM ${suffix}`, name),
            );

            // * The conversation is still a group message
            expect((await adminClient.getChannel(groupMessage.id)).type).toBe('G');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
