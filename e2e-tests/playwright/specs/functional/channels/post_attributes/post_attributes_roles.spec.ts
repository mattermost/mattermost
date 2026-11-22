// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {PropertyField} from '@mattermost/types/properties';

import {expect, test, type App} from '@mattermost/playwright-lib';

import {
    addMember,
    chooseOption,
    createField,
    deleteFields,
    enableGuestAccounts,
    fieldName,
    grantValueWrite,
    openModalFromPostMenu,
    optionId,
    purgeFields,
    sealField,
    sendMessage,
    setPostValues,
    skipIfNoPostAttributesLicense,
    stageField,
} from './support';

// The padlock's accessible name: the one thing that tells it from the row's other glyphs.
const LOCKED_REASON = "You don't have permission to modify this attribute.";

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
async function expectModalAccess(app: App, postId: string, fields: LevelFields, editable: Level[]) {
    const modal = await openModalFromPostMenu(app, app.center.postList.post({id: postId}));

    for (const level of LEVELS) {
        const row = modal.attribute(fields[level]);

        await expect(row.container).toBeVisible();

        if (editable.includes(level)) {
            await expect(row.valueButton, `${level} should be editable`).toBeVisible();
            await expect(row.lockedImg, `${level} should not be locked`).toHaveCount(0);
        } else {
            await expect(row.valueButton, `${level} should have no control`).toHaveCount(0);
            await expect(row.lockedImg, `${level} should be locked`).toBeVisible();
            await expect(row.lockedImg, `${level} padlock should say why`).toHaveAccessibleName(LOCKED_REASON);
        }
    }

    await app.page.keyboard.press('Escape');
    await expect(modal.container).toBeHidden();
}

/**
 * Writes a value at one level as a client acting as one user: it resolves when the server takes the write, and
 * rejects with the server's error when it refuses it.
 */
function writeValue(client: Client4, postId: string, field: PropertyField) {
    return setPostValues(client, postId, [{field_id: field.id, value: optionId(field, 'HIGH')}]);
}

/**
 * Asks the server the question the modal answered, so a page and a server that disagree
 * fail here instead of passing each on its own terms.
 */
async function expectServerAccess(client: Client4, postId: string, fields: LevelFields, editable: Level[]) {
    for (const level of LEVELS) {
        const write = writeValue(client, postId, fields[level]);

        if (editable.includes(level)) {
            await expect(write, `${level} write`).resolves.toBeUndefined();
        } else {
            await expect(write, `${level} write`).rejects.toMatchObject({status_code: 403});
        }
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
    await skipIfNoPostAttributesLicense();
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        // * Verify on somebody else's post only the `member` field is editable
        await expectModalAccess(app, theirs.id, fields, ['member']);
        await expectServerAccess(userClient, theirs.id, fields, ['member']);

        // * Verify on the member's own post the `creator` field opens too
        await expectModalAccess(app, mine.id, fields, ['member', 'creator']);
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
        await skipIfNoPostAttributesLicense();
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

            const {app} = await pw.testBrowser.login(administrator);
            await app.channelsPage.goto({team, channel});

            // * Verify the modal offers exactly the levels the role reaches
            await expectModalAccess(app, post.id, fields, editable);

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
    await skipIfNoPostAttributesLicense();
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

        const {app} = await pw.testBrowser.login(user);

        const conversations: Array<{label: string; channel: Channel; route: string}> = [
            {label: 'dm', channel: dm, route: `@${alice.username}`},
            {label: 'gm', channel: gm, route: gm.name},
        ];

        for (const {label, channel, route} of conversations) {
            // # Alice posts in the conversation, with every level's value on it
            const post = await aliceClient.createPost({channel_id: channel.id, message: `${label} ${suffix}`});
            await setEveryLevel(adminClient, post.id, fields);

            await app.channelsPage.goto({team, path: 'messages', channel: route});

            // * Verify a participant may change everything but the `sysadmin` field, though
            // nobody here holds a channel role
            const editable: Level[] = ['member', 'creator', 'admin'];
            await expectModalAccess(app, post.id, fields, editable);
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
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    await skipIfNoPostAttributesLicense();

    // The guest setting is put back by the config reset every test starts with
    const {adminClient, team} = await pw.initSetup();
    const guestsAllowed = await enableGuestAccounts(adminClient);
    test.skip(!guestsAllowed, 'the licence does not allow guest accounts');

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

        const {app} = await pw.testBrowser.login(guest);
        await app.channelsPage.goto({team, path: 'messages', channel: `@${alice.username}`});

        // * Verify the guest may change the `member` field and nothing else, though a
        // non-guest in the same place may change `admin` too
        await expectModalAccess(app, post.id, fields, ['member']);
        await expectServerAccess(guestClient, post.id, fields, ['member']);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a guest can set `member` fields, and `creator` fields on their own post,
 * from the composer and from the modal, and is offered no `admin` field.
 *
 * @precondition The PostAttributes feature flag is enabled, and the licence allows guest accounts.
 */
test('lets a guest set member and creator fields on their own post', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    await skipIfNoPostAttributesLicense();

    // The guest setting is put back by the config reset every test starts with
    const {adminClient, team} = await pw.initSetup();
    const guestsAllowed = await enableGuestAccounts(adminClient);
    test.skip(!guestsAllowed, 'the licence does not allow guest accounts');

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

        const {app, page} = await pw.testBrowser.login(guest);
        await app.channelsPage.goto({team, channel});

        const composer = app.center.postCreate;
        const picker = composer.postAttributesButton;

        // * Verify the picker offers the `member` and `creator` fields, and neither of the
        // levels above them
        await picker.addButton.clickTo(picker.addMenu);
        await expect(picker.addMenu.field(fields.member)).toBeVisible();
        await expect(picker.addMenu.field(fields.creator)).toBeVisible();
        await expect(picker.addMenu.field(fields.admin)).toHaveCount(0);
        await expect(picker.addMenu.field(fields.sysadmin)).toHaveCount(0);
        await app.page.keyboard.press('Escape');
        await expect(picker.addMenu.container).toBeHidden();

        // # Stage both and send
        await stageField(composer, fields.member);
        await chooseOption(composer, fields.member, 'HIGH');
        await stageField(composer, fields.creator);
        await chooseOption(composer, fields.creator, 'HIGH');

        // The send resolves once the server has answered, so the guest's own client can list the post
        const {values, post} = await sendMessage(page, composer, `guest post ${suffix}`);

        // * Verify both values were sent, and the post took them
        expect(values).toEqual(
            expect.arrayContaining([
                {field_id: fields.member.id, value: optionId(fields.member, 'HIGH')},
                {field_id: fields.creator.id, value: optionId(fields.creator, 'HIGH')},
            ]),
        );

        const onScreen = app.center.postList.post(post);
        await expect(onScreen.attributes.value.selectText).toHaveCount(2);

        // # An admin sets the other two levels on the guest's post, so every row shows
        await setEveryLevel(adminClient, post.id, fields);

        // * Verify in the modal the guest's own post opens `member` and `creator`, and locks the rest
        await expectModalAccess(app, post.id, fields, ['member', 'creator']);
        await expectServerAccess(guestClient, post.id, fields, ['member', 'creator']);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a `none` field gives nobody a control: a system admin and a member see
 * a padlock and no way in on the modal's row, and the composer never offers it. The server
 * refuses a write from either. A value the field already held still renders, as a chip on the
 * post and as text on the row.
 *
 * A value cannot be stored under a field that is `none` from the start, so the field is
 * created writable, given its value, and then sealed through its `permissions` object.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test(
    'gives nobody a control for a field set to none, a system admin included',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await skipIfNoPostAttributesLicense();
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
                permissionValues: 'member',
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
            // LOW, so the refused writes below (always HIGH) would change the value
            await setPostValues(adminClient, post.id, [{field_id: sealed.id, value: optionId(sealed, 'LOW')}]);
            await sealField(adminClient, sealed);
            const {user: sysadmin, client: sysadminClient} = await addMember(pw, adminClient, team, [channel.id], {
                systemAdmin: true,
            });

            for (const [label, viewer, client] of [
                ['member', user, userClient],
                ['system admin', sysadmin, sysadminClient],
            ] as const) {
                const {app} = await pw.testBrowser.login(viewer);
                await app.channelsPage.goto({team, channel});

                const picker = app.center.postCreate.postAttributesButton;

                // * Verify the composer offers the ordinary field and not the `none` one
                await picker.addButton.clickTo(picker.addMenu);
                await expect(picker.addMenu.field(open), `${label} is offered the ordinary field`).toBeVisible();
                await expect(picker.addMenu.field(sealed), `${label} is not offered the sealed one`).toHaveCount(0);
                await app.page.keyboard.press('Escape');
                await expect(picker.addMenu.container).toBeHidden();

                // * Verify the value the field already held still renders on the post
                const onScreen = app.center.postList.post(post);
                await expect(onScreen.attributes.container).toContainText('LOW');

                // * Verify the modal's row is there, locked, with its value and no control
                const modal = await openModalFromPostMenu(app, onScreen, {keyboard: true});
                await expect(modal.attribute(sealed).container).toContainText('LOW');
                await expect(modal.attribute(sealed).lockedImg).toBeVisible();
                await expect(modal.attribute(sealed).lockedImg).toHaveAccessibleName(LOCKED_REASON);
                await expect(modal.attribute(sealed).valueButton).toHaveCount(0);
                await expect(modal.attribute(open).valueButton).toBeVisible();

                // * Verify the server refuses a write from them
                await expect(writeValue(client, post.id, sealed), `${label} write`).rejects.toMatchObject({
                    status_code: 403,
                });
            }
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);

/**
 * Checks, for one viewer, every field the case cares about in the three places a value can
 * be set: a control or a padlock on the modal's row for a post by somebody else, the
 * server's answer to a write on that post, and whether the composer's picker offers it.
 */
async function expectFieldAccess(
    app: App,
    client: Client4,
    postId: string,
    {editable, locked}: {editable: PropertyField[]; locked: PropertyField[]},
) {
    const modal = await openModalFromPostMenu(app, app.center.postList.post({id: postId}));

    for (const field of editable) {
        await expect(modal.attribute(field).valueButton, `${field.name} should be editable`).toBeVisible();
        await expect(modal.attribute(field).lockedImg, `${field.name} should not be locked`).toHaveCount(0);
    }
    for (const field of locked) {
        await expect(modal.attribute(field).valueButton, `${field.name} should have no control`).toHaveCount(0);
        await expect(modal.attribute(field).lockedImg, `${field.name} should be locked`).toBeVisible();
        await expect(modal.attribute(field).lockedImg).toHaveAccessibleName(LOCKED_REASON);
    }

    await app.page.keyboard.press('Escape');
    await expect(modal.container).toBeHidden();

    for (const field of editable) {
        await expect(writeValue(client, postId, field), `${field.name} write`).resolves.toBeUndefined();
    }
    for (const field of locked) {
        await expect(writeValue(client, postId, field), `${field.name} write`).rejects.toMatchObject({
            status_code: 403,
        });
    }

    const picker = app.center.postCreate.postAttributesButton;
    await picker.addButton.clickTo(picker.addMenu);
    for (const field of editable) {
        await expect(picker.addMenu.field(field), `${field.name} should be offered`).toBeVisible();
    }
    for (const field of locked) {
        await expect(picker.addMenu.field(field), `${field.name} should not be offered`).toHaveCount(0);
    }
    await app.page.keyboard.press('Escape');
    await expect(picker.addMenu.container).toBeHidden();
}

/**
 * @objective Verify a value.write grant opens a field to the people it names whatever the
 * field's tier, and that an `everyone` field is open to any member. A member named by a user
 * grant or holding the role a role grant names gets a control on somebody else's post, is
 * offered the field in the composer, and has their write and their new post with a value
 * accepted by the server. A member no grant names sees a padlock, is not offered the field
 * and is refused.
 *
 * @precondition The PostAttributes and PropertyFieldPermissionsV3 feature flags are enabled.
 * The client only receives a field's grants with PropertyFieldPermissionsV3 on.
 */
test(
    'opens a field to the members a value.write grant names, and to anyone at everyone',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);
        await pw.ensureFeatureFlag('PropertyFieldPermissionsV3', true);

        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            // # Two sysadmin-level fields, one granted to the member by user and one granted to
            // every system user by role, and an `everyone` field with no grant at all
            const byUser = await createField(adminClient, fieldName('byuser', suffix), {
                options: ['LOW', 'HIGH'],
                permissionValues: 'sysadmin',
                visibility: 'always',
                sortOrder: 1,
            });
            created.push(byUser);

            const byRole = await createField(adminClient, fieldName('byrole', suffix), {
                options: ['LOW', 'HIGH'],
                permissionValues: 'sysadmin',
                visibility: 'always',
                sortOrder: 2,
            });
            created.push(byRole);

            const everyone = await createField(adminClient, fieldName('everyone', suffix), {
                options: ['LOW', 'HIGH'],
                permissionValues: 'everyone',
                visibility: 'always',
                sortOrder: 3,
            });
            created.push(everyone);

            await grantValueWrite(adminClient, byUser, [{type: 'user', id: user.id}]);
            await grantValueWrite(adminClient, byRole, [{type: 'role', id: 'system_user'}]);

            // # A post by somebody else, carrying a value for each field
            const channel = await adminClient.getChannelByName(team.id, 'town-square');
            const {client: author} = await addMember(pw, adminClient, team, [channel.id]);
            const {user: other, client: otherClient} = await addMember(pw, adminClient, team, [channel.id]);
            const theirs = await author.createPost({channel_id: channel.id, message: `theirs ${suffix}`});
            await setPostValues(
                adminClient,
                theirs.id,
                [byUser, byRole, everyone].map((field) => ({field_id: field.id, value: optionId(field, 'LOW')})),
            );

            // * Verify the member the user grant names can set all three
            const granted = await pw.testBrowser.login(user);
            await granted.app.channelsPage.goto({team, channel});
            await expectFieldAccess(granted.app, userClient, theirs.id, {
                editable: [byUser, byRole, everyone],
                locked: [],
            });

            // * Verify they can send a new post with the user-granted field set from the composer.
            // The send resolves once the server has created the post.
            const composer = granted.app.center.postCreate;
            await stageField(composer, byUser);
            await chooseOption(composer, byUser, 'HIGH');
            const {post: sent} = await sendMessage(granted.page, composer, `granted ${suffix}`);

            await expect(granted.app.center.postList.post(sent).attributes.value.selectText).toContainText('HIGH');

            // * Verify a member the user grant does not name is locked out of that field only
            const notGranted = await pw.testBrowser.login(other);
            await notGranted.app.channelsPage.goto({team, channel});
            await expectFieldAccess(notGranted.app, otherClient, theirs.id, {
                editable: [byRole, everyone],
                locked: [byUser],
            });
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);
