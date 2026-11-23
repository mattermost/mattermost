// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {Page} from '@playwright/test';
import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';
import type {ChannelsPage} from '@mattermost/playwright-lib';

import {
    addMember,
    chooseOption,
    composerPlus,
    createField,
    deleteFields,
    enableGuestAccounts,
    fieldName,
    modalRow,
    modalTrigger,
    openModalFromPostMenu,
    optionId,
    pickerItem,
    purgeFields,
    sentValues,
    setPostValues,
    stageField,
    waitForCreatePost,
} from './support';

// `GenericModal` renders `role='none'`, so the element id it forwards is the only stable
// handle on the modal itself.
const MODAL = '#postAttributesModal';

// The padlock's accessible name: the one thing that tells it from the row's other glyphs.
const LOCKED_REASON = "You don't have permission to modify this attribute.";

const CHIPS = 'post-attributes-chips';
const OPTION_CHIP = 'select-property';

const LEVELS = ['member', 'creator', 'admin', 'sysadmin'] as const;
type Level = (typeof LEVELS)[number];
type LevelFields = Record<Level, PropertyField>;

/**
 * One select field per permission level a value can be written at, all system-scoped, so
 * they apply to every channel, direct and group messages included.
 */
async function createLevelFields(adminClient: Client4, suffix: string, created: PropertyField[]): Promise<LevelFields> {
    const fields = {} as LevelFields;

    for (const [index, level] of LEVELS.entries()) {
        fields[level] = await createField(adminClient, fieldName(level, suffix), {
            options: ['LOW', 'HIGH'],
            permissionValues: level,
            sortOrder: index + 1,
        });
        created.push(fields[level]);
    }

    return fields;
}

// Gives a post a value for every level's field. Only a system admin may write them all.
async function setEveryLevel(adminClient: Client4, postId: string, fields: LevelFields) {
    await setPostValues(
        adminClient,
        postId,
        LEVELS.map((level) => ({field_id: fields[level].id, value: optionId(fields[level], 'LOW')})),
    );
}

/**
 * Opens the post's attributes modal and checks every level's row: a control for the levels
 * in `editable`, and a padlock with no control for the others.
 */
async function expectModalAccess(
    page: Page,
    channelsPage: ChannelsPage,
    postId: string,
    fields: LevelFields,
    editable: Level[],
) {
    const post = await channelsPage.centerView.getPostById(postId);
    await openModalFromPostMenu(channelsPage, post);

    const modal = page.locator(MODAL);
    await expect(modal).toBeVisible();

    for (const level of LEVELS) {
        const padlock = modalRow(page, fields[level]).getByRole('img', {name: LOCKED_REASON});

        await expect(modalRow(page, fields[level])).toBeVisible();

        if (editable.includes(level)) {
            await expect(modalTrigger(page, fields[level]), `${level} should be editable`).toBeVisible();
            await expect(padlock, `${level} should not be locked`).toHaveCount(0);
        } else {
            await expect(modalTrigger(page, fields[level]), `${level} should have no control`).toHaveCount(0);
            await expect(padlock, `${level} should be locked`).toBeVisible();
        }
    }

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
}

// The status a value write gets from the server, for a client acting as one user.
async function writeStatus(client: Client4, postId: string, field: PropertyField): Promise<number> {
    try {
        await setPostValues(client, postId, [{field_id: field.id, value: optionId(field, 'HIGH')}]);
        return 200;
    } catch (error) {
        return (error as {status_code: number}).status_code;
    }
}

/**
 * Asks the server the question the modal answered, so a page and a server that disagree
 * fail here instead of passing each on its own terms.
 */
async function expectServerAccess(client: Client4, postId: string, fields: LevelFields, editable: Level[]) {
    for (const level of LEVELS) {
        expect(await writeStatus(client, postId, fields[level]), `${level} write`).toBe(
            editable.includes(level) ? 200 : 403,
        );
    }
}

/**
 * @objective Verify a member sees which fields are theirs to change on somebody else's post:
 * `member` fields editable, `creator`, `admin` and `sysadmin` locked behind a padlock; and
 * that on their own post `creator` fields open up too. The server answers the same.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('locks the fields a member may not change on a post by another user', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const fields = await createLevelFields(adminClient, suffix, created);
        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const {client: author} = await addMember(pw, adminClient, team, [channel.id]);

        // # One post by somebody else and one by the member, each carrying every level's value
        const theirs = await author.createPost({channel_id: channel.id, message: `theirs ${suffix}`});
        const mine = await userClient.createPost({channel_id: channel.id, message: `mine ${suffix}`});
        await setEveryLevel(adminClient, theirs.id, fields);
        await setEveryLevel(adminClient, mine.id, fields);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify on somebody else's post only the `member` field is editable
        await expectModalAccess(page, channelsPage, theirs.id, fields, ['member']);
        await expectServerAccess(userClient, theirs.id, fields, ['member']);

        // * Verify on the member's own post the `creator` field opens too
        await expectModalAccess(page, channelsPage, mine.id, fields, ['member', 'creator']);
        await expectServerAccess(userClient, mine.id, fields, ['member', 'creator']);
    } finally {
        await deleteFields(adminClient, created);
    }
});

const ADMIN_ROLES: Array<{
    title: string;
    roles: {systemAdmin?: boolean; teamAdmin?: boolean; channelAdmin?: boolean};
    editable: Level[];
}> = [
    {title: 'a system admin', roles: {systemAdmin: true}, editable: ['member', 'creator', 'admin', 'sysadmin']},
    {title: 'a channel admin', roles: {channelAdmin: true}, editable: ['member', 'creator', 'admin']},
    {title: 'a team admin who is on the channel', roles: {teamAdmin: true}, editable: ['member', 'creator', 'admin']},
];

for (const {title, roles, editable} of ADMIN_ROLES) {
    /**
     * @objective Verify an administrator can change somebody else's values at the levels their
     * role reaches, and no further: a system admin at every level, a channel admin and a team
     * admin who is a channel member up to `admin` but not `sysadmin`. The server answers the same.
     *
     * @precondition The PostAttributes feature flag is enabled.
     */
    test(`lets ${title} change the fields their role reaches`, {tag: '@post_attributes'}, async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            const fields = await createLevelFields(adminClient, suffix, created);
            const channel = await adminClient.getChannelByName(team.id, 'town-square');
            const {client: author} = await addMember(pw, adminClient, team, [channel.id]);
            const {user: administrator, client} = await addMember(pw, adminClient, team, [channel.id], roles);

            const post = await author.createPost({channel_id: channel.id, message: `administered ${suffix}`});
            await setEveryLevel(adminClient, post.id, fields);

            const {page, channelsPage} = await pw.testBrowser.login(administrator);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // * Verify the modal offers exactly the levels the role reaches
            await expectModalAccess(page, channelsPage, post.id, fields, editable);

            // * Verify the server agrees
            await expectServerAccess(client, post.id, fields, editable);
        } finally {
            await deleteFields(adminClient, created);
        }
    });
}

/**
 * @objective Verify the members of a direct message and of a group message count as admins
 * for `admin`-level fields, `sysadmin` fields stay locked, and the server agrees.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('treats members of a direct and a group message as admins', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const fields = await createLevelFields(adminClient, suffix, created);
        const {user: alice, client: aliceClient} = await addMember(pw, adminClient, team, []);
        const {user: bob} = await addMember(pw, adminClient, team, []);
        const dm = await adminClient.createDirectChannel([user.id, alice.id]);
        const gm = await adminClient.createGroupChannel([user.id, alice.id, bob.id]);

        const {page, channelsPage} = await pw.testBrowser.login(user);

        for (const [label, channel] of [
            ['dm', dm],
            ['gm', gm],
        ] as Array<[string, Channel]>) {
            // # Alice posts in the conversation, with every level's value on it
            const post = await aliceClient.createPost({channel_id: channel.id, message: `${label} ${suffix}`});
            await setEveryLevel(adminClient, post.id, fields);

            if (label === 'dm') {
                await channelsPage.goto(team.name, `@${alice.username}`);
            } else {
                await channelsPage.gotoMessage(team.name, gm.name);
            }
            await channelsPage.toBeVisible();

            // * Verify a participant may change everything but the `sysadmin` field, though
            // nobody here holds a channel role
            const editable: Level[] = ['member', 'creator', 'admin'];
            await expectModalAccess(page, channelsPage, post.id, fields, editable);
            await expectServerAccess(userClient, post.id, fields, editable);
        }
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a guest in a direct message is not an admin there: `member` is editable,
 * and `creator`, `admin` and `sysadmin` fields on the other person's post are locked.
 *
 * @precondition The PostAttributes feature flag is enabled, and the licence allows guest accounts.
 */
test('does not make a guest an admin of a direct message', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    await pw.skipIfNoLicense();

    const {adminClient, team} = await pw.initSetup();
    const restoreGuests = await enableGuestAccounts(adminClient);
    test.skip(!restoreGuests, 'the licence does not allow guest accounts');

    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const fields = await createLevelFields(adminClient, suffix, created);

        // # A conversation between a guest and a member, with a post by the member
        const {user: alice, client: aliceClient} = await addMember(pw, adminClient, team, []);
        const {user: guest, client: guestClient} = await addMember(pw, adminClient, team, [], {guest: true});
        const dm = await adminClient.createDirectChannel([guest.id, alice.id]);

        const post = await aliceClient.createPost({channel_id: dm.id, message: `guest dm ${suffix}`});
        await setEveryLevel(adminClient, post.id, fields);

        const {page, channelsPage} = await pw.testBrowser.login(guest);
        await channelsPage.goto(team.name, `@${alice.username}`);
        await channelsPage.toBeVisible();

        // * Verify the guest may change the `member` field and nothing else, though a
        // non-guest in the same place may change `admin` too
        await expectModalAccess(page, channelsPage, post.id, fields, ['member']);
        await expectServerAccess(guestClient, post.id, fields, ['member']);
    } finally {
        await deleteFields(adminClient, created);
        await restoreGuests?.();
    }
});

/**
 * @objective Verify a guest can set `member` fields, and `creator` fields on their own post,
 * from the composer and from the modal, and is offered no `admin` field.
 *
 * @precondition The PostAttributes feature flag is enabled, and the licence allows guest accounts.
 */
test('lets a guest set member and creator fields on their own post', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    await pw.skipIfNoLicense();

    const {adminClient, team} = await pw.initSetup();
    const restoreGuests = await enableGuestAccounts(adminClient);
    test.skip(!restoreGuests, 'the licence does not allow guest accounts');

    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const fields = await createLevelFields(adminClient, suffix, created);

        // # A channel the guest is in, and the guest
        const channel = await adminClient.createChannel(
            pw.random.channel({teamId: team.id, name: 'attrs', displayName: 'Attrs', unique: true}),
        );
        const {user: guest, client: guestClient} = await addMember(pw, adminClient, team, [channel.id], {guest: true});

        const {page, channelsPage} = await pw.testBrowser.login(guest);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const composer = channelsPage.centerView.postCreate;
        const scope = composer.container;

        // * Verify the picker offers the `member` and `creator` fields, and neither of the
        // levels above them
        await composerPlus(scope).click();
        await expect(pickerItem(page, fields.member)).toBeVisible();
        await expect(pickerItem(page, fields.creator)).toBeVisible();
        await expect(pickerItem(page, fields.admin)).toHaveCount(0);
        await expect(pickerItem(page, fields.sysadmin)).toHaveCount(0);
        await page.keyboard.press('Escape');

        // # Stage both and send
        await stageField(page, scope, fields.member);
        await chooseOption(page, 'HIGH');
        await stageField(page, scope, fields.creator);
        await chooseOption(page, 'HIGH');

        await composer.writeMessage(`guest post ${suffix}`);
        const request = waitForCreatePost(page);
        await composer.sendMessage();

        // * Verify both values were sent, and the post took them
        expect(sentValues(await request)).toEqual(
            expect.arrayContaining([
                {field_id: fields.member.id, value: optionId(fields.member, 'HIGH')},
                {field_id: fields.creator.id, value: optionId(fields.creator, 'HIGH')},
            ]),
        );

        // The request resolving means only that the browser sent it; the guest's own
        // client lists the channel separately, so wait until the server has answered.
        await (await request).response();

        const sent = (await guestClient.getPosts(channel.id)).posts;
        const post = Object.values(sent).find((candidate) => candidate.message === `guest post ${suffix}`)!;
        const onScreen = await channelsPage.centerView.getPostById(post.id);
        await expect(onScreen.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveCount(2);

        // # An admin sets the other two levels on the guest's post, so every row shows
        await setEveryLevel(adminClient, post.id, fields);

        // * Verify in the modal the guest's own post opens `member` and `creator`, and locks the rest
        await expectModalAccess(page, channelsPage, post.id, fields, ['member', 'creator']);
        await expectServerAccess(guestClient, post.id, fields, ['member', 'creator']);
    } finally {
        await deleteFields(adminClient, created);
        await restoreGuests?.();
    }
});

/**
 * @objective Verify a `none` field gives nobody a control: a system admin and a member see
 * a padlock and no way in on the modal's row, and the composer never offers it. The server
 * refuses a write from either.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test(
    'gives nobody a control for a field set to none, a system admin included',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            // # A `none` field whose row always shows, and an ordinary field, so the composer
            // has something to offer and the absence of the first is about the first
            const sealed = await createField(adminClient, fieldName('sealed', suffix), {
                options: ['LOW', 'HIGH'],
                permissionValues: 'none',
                visibility: 'always',
                sortOrder: 1,
            });
            const open = await createField(adminClient, fieldName('open', suffix), {
                options: ['LOW', 'HIGH'],
                visibility: 'always',
                sortOrder: 2,
            });
            created.push(sealed, open);

            const channel = await adminClient.getChannelByName(team.id, 'town-square');
            const post = await userClient.createPost({channel_id: channel.id, message: `sealed ${suffix}`});
            const {user: sysadmin, client: sysadminClient} = await addMember(pw, adminClient, team, [channel.id], {
                systemAdmin: true,
            });

            for (const [label, viewer, client] of [
                ['member', user, userClient],
                ['system admin', sysadmin, sysadminClient],
            ] as const) {
                const {page, channelsPage} = await pw.testBrowser.login(viewer);
                await channelsPage.goto(team.name, channel.name);
                await channelsPage.toBeVisible();

                // * Verify the composer offers the ordinary field and not the `none` one
                await composerPlus(channelsPage.centerView.postCreate.container).click();
                await expect(pickerItem(page, open), `${label} is offered the ordinary field`).toBeVisible();
                await expect(pickerItem(page, sealed), `${label} is not offered the sealed one`).toHaveCount(0);
                await page.keyboard.press('Escape');

                // * Verify the modal's row is there, locked, with no control
                const onScreen = await channelsPage.centerView.getPostById(post.id);
                await openModalFromPostMenu(channelsPage, onScreen);
                await expect(page.locator(MODAL)).toBeVisible();
                await expect(modalRow(page, sealed).getByRole('img', {name: LOCKED_REASON})).toBeVisible();
                await expect(modalTrigger(page, sealed)).toHaveCount(0);
                await expect(modalTrigger(page, open)).toBeVisible();

                // * Verify the server refuses a write from them
                expect(await writeStatus(client, post.id, sealed), `${label} write`).toBe(403);
            }
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);
