---
title: "Bot accounts"
sidebar_position: 30
---

Bot accounts access the Mattermost [RESTful API](https://api.mattermost.com) on behalf of a bot through the use of the [personal access tokens feature](/developers/integrate/reference/personal-access-token). Bot accounts are just like user accounts, except they:

  - Can't be logged into.
  - Can't be used to create other bot accounts.
  - Can't be used to upload files to a channel, unless they are also added to the channel as a channel member.
  - Don't count as a registered user and therefore don't count towards the total number of users for an Enterprise Edition license.

Additional benefits include:

  - System Admins can enable bot accounts to post to any channel in the system, including private teams, Private channels, or Direct Messages.
  - Integrations created by a user and tied to a bot account no longer break if the user leaves the company.
  - Once created, bot accounts behave just like regular user accounts and can be added to teams and channels similar to users.
  - Bot accounts are a safer way to integrate with Mattermost through the RESTful API and Plugin API because there is no need to manage shared logins with these accounts.
  - A `BOT` tag is used throughout Mattermost where bot accounts are referenced, including messages and user lists.

Note that currently:

  - Only System Admins or plugins can create or manage bot accounts.
  - In Mattermost Enterprise Edition, service accounts without an email address pulled from LDAP or SAML systems are not yet supported.

If you would like to see improvements to bot accounts, [let us know in the Feature Proposal Forum](https://mattermost.uservoice.com).

## Configuration settings

By default, plugins can create and manage bot accounts. To enable bot account creation through the user interface or the RESTful API:

1. Go to **System Console > Integrations > Bot Accounts**.
2. Set **Enable Bot Account Creation** to **true**.

Once set, System Admin can create bot accounts for integrations using the **Integrations > Bot Accounts** link in the description provided.

## Bot account creation

Below are different ways to create bot accounts. After the bot account is created, make sure to:

1. Copy the generated bot access token for your integration.
2. To add the bot account to teams and channels you want it to interact in, select the team drop-down menu, then select **Invite People**. Next, select **Invite Member** and enter the bot account in the **Add or Invite People** field. Then select **Invite Members**. You should now be able to add the bot account to channels like any other user.

### User interface (UI)

1. Go to the Product menu and select **Integrations > Bot Accounts**.
2. Select **Add Bot Account**.
3. Set the **Username** of the bot. The username must begin with a letter, and contain between 3 and 22 lowercase characters made up of numbers, letters, and symbols including ".", "-", or "\_".
4. (Optional) Upload an image for the **Bot Icon**. This will be used as the profile image of the bot throughout Mattermost.
5. (Optional) Set a **Display Name** and **Description**.
6. (Optional) Choose what role the bot should have. Defaults to **Member**. If you assign **System Admin**, the bot will have read and write access for any Public channels, Private channels, and Direct Messages.
7. (Optional) Select additional permissions for the account. Enable the bot to post to all Mattermost channels, or post to all Mattermost Public channels.
8. (Optional) From Mattermost v12.1, set the bot's **Attributes**. Select **Add attribute**, choose an attribute, and enter or select its value. Select the trash icon next to an attribute to remove it. Required attributes must have a value before you can save. See [Bot attributes](#bot-attributes) for details.
9. Select **Create Bot Account**.
10. Copy the token displayed on the **Setup Successful** page before you select **Done** as you won't have access to the token again once you close the screen.

### RESTful API

Use the RESTful API `POST /bots` to create a bot. You must have permissions to create bots.

See our [API documentation](https://api.mattermost.com/#tag/bots) to learn more about creating and managing bots through the API.

To authorize your bot via RESTful API use `curl -i -H 'authorization: Bearer <Access Token>' http://localhost:8065/api/v4/users/me`. **Access Token** is not the `Token ID` and won't be visible again once created.

### Command line interface (CLI)

You can use the following CLI command to convert an existing user account to a bot:

```shell
user convert user@example.com --bot
```

In addition to email, you can identify the user by its username or user ID.

Bot accounts which were converted from user accounts will have their authentication data cleared if they were email/password accounts. Those synchronized from LDAP/SAML will not have their authentication data cleared so that LDAP/SAML synchronization performs correctly.

### Plugins

Plugins can create bot accounts through an `EnsureBot` helper function. For an example, see [the Demo Plugin](https://github.com/mattermost/mattermost-plugin-demo/blob/master/server/configuration.go#L210-L217).

Bots created by a plugin use the plugin's ID as the creator, unless otherwise specified by the plugin.

## Bot attributes

From Mattermost v12.1, with a Mattermost Enterprise or Enterprise Advanced license, you can set [user attribute](https://docs.mattermost.com/administration-guide/manage/admin/attribute-management) values on bot accounts, the same way you set them on users. Bot attributes are shown in the bot's profile popover, and they're evaluated by [attribute-based access control (ABAC)](https://docs.mattermost.com/administration-guide/manage/admin/attribute-based-access-control) policies.

<Important>

Membership policies and permission policies apply to bot accounts exactly as they apply to users. A bot that doesn't have the attribute values a policy requires can't be added to private channels or teams governed by that policy, is removed from them during synchronization, and can't perform actions a permission policy restricts. Set the bot's attributes before adding it to channels or teams that use access policies.

</Important>

### Who can set bot attribute values

- The bot's owner, if they have permission to manage bots. Managing bots owned by others requires permission to manage other users' bots.
- System Admins.

The following attributes can't be set by bot owners who aren't System Admins:

- Attributes whose **Who can set the value** setting is **System Administrator**. Only System Admins can set these values.
- Attributes on a bot that has the **System Admin** role. Only System Admins can change these values.

Attributes synchronized from AD/LDAP or SAML are read-only and can't be edited for bots.

### Set bot attribute values

- **User interface**: Go to **Product menu > Integrations > Bot Accounts**, then select **Edit** for the bot, or set attributes when you [create the bot](#user-interface-ui). Select **Add attribute** to add a value, or the trash icon to remove one. System Admins can select **Manage attributes** to open **System Console > System Attributes > Attribute Management** and define new attributes.
- **RESTful API**: Send `PATCH /api/v4/users/{bot_user_id}/custom_profile_attributes` with a map of attribute IDs to values, authenticated as the bot's owner or a System Admin. A bot can also update its own values using its access token.

If the bot account is created but some of its settings can't be saved, such as its attributes, icon, roles, or access token, Mattermost shows a **Bot account created, but some settings were not saved** banner that lists what failed. Edit the bot to set those settings again.

## Technical notes

### Data model

Each bot account has a row in the **Users** table and the **Bots** table. The entries are tied together by `User.Id = Bot.UserId`.

The Bots table schema is described as follows:

| Field       | Description                     | Type   | Required | 
|-------------|---------------------------------|--------|----------|
| UserId      | User ID of the bot user         | string | Y        |
| Username    | Username of the bot account     | string | Y        |   
| DisplayName | Display name of the bot account | string | N        |   
| Description | Description of the bot account  | string | N        |
| OwnerId     | User ID of the owner of the bot | string | Y        |
| CreateAt    | Unix timestamp of creation time | int64  | Y        |
| UpdateAt    | Unix timestamp of update time   | int64  | Y        |
| DeleteAt    | Unix timestamp of deletion time | int64  | Y        |

## Frequently asked questions

### Should I migrate all my integrations to use bot accounts?

For your integrations using RESTful API and plugins, yes. To do so, you can either convert an existing account to a bot, or create a new bot account using the steps outlined above.

Once you create a bot account, use the generated token to access the RESTful API on behalf of a bot and interact in the Mattermost server.

For your webhook and slash command integrations, you cannot migrate them to use bot accounts, as they require a user account at this time. However, an option is to migrate the webhooks or slash commands to a plugin, which in turn can use bot accounts.

### What happens if a plugin is using a bot account that already exists as a user account?

For a concrete example, suppose you enable the [Mattermost GitHub plugin](https://github.com/mattermost/mattermost-plugin-github), which uses a `github` bot account, while an existing `github` user account was created for webhook integrations.

Once the plugin is enabled, the plugin posts as the `github` account but without a `BOT` tag. An error message is logged to the server logs recommending the System Admin to convert the `github` user to a bot account by running `mattermost user convert <username> --bot` in the CLI.

If the user is an existing user account you want to preserve, change its username and restart the Mattermost server, after which the plugin will create a bot account with the name `github`.

### How do I convert an existing account to a bot account?

Use the following CLI command to convert an existing user account to a bot:

`user convert user@example.com --bot`

In addition to email, you may identify the user by its username or user ID.

Bot accounts which were converted from user accounts will have their authentication data cleared if they were email/password accounts. Those synchronized from LDAP/SAML will not have their authentication data cleared so that LDAP/SAML synchronization performs correctly.

### How can I quickly test if my bot account is working?

Add the bot to a team and channel you belong to, then use the following curl command to post with the bot:

`curl -i -X POST -H 'Content-Type: application/json' -d '{"channel_id":"<channel-id>", "message":"This is a message from a bot", "props":{"attachments": [{"pretext": "Look some text","text": "This is text"}]}}' -H 'Authorization: Bearer <bot-access-token>' <mattermost-url>/api/v4/posts`

Replace the following parameters:

- `<channel-id>` with the channel you added the bot to
- `<bot-access-token>` with the bot access token generated when you created the bot account
- `<mattermost-url>` with your Mattermost domain, e.g. ``https://example.mattermost.com``

### Do bot access tokens expire?

No, but you can automate your integration to cycle its token through the REST API:
1. Use [GetUserAccessTokensForUser](https://api.mattermost.com/#operation/GetUserAccessTokensForUser) to list the existing tokens for the `bot` user.
2. Use [CreateUserAccessToken](https://api.mattermost.com/#operation/CreateUserAccessToken) to generate a new token.
3. Update the services that leverage the token with the new `token` value from step 1.
4. Use [RevokeUserAccessToken](https://api.mattermost.com/#operation/RevokeUserAccessToken) to revoke the old token based on the `token_id`.

For more information about access tokens, see [the personal access tokens documentation](/developers/integrate/reference/personal-access-token).

### Do bot accounts make it easier to impersonate someone else such as the CEO or an HR coordinator?

Possibly yes. Currently a System Admin can disable overriding the profile picture and the username from integrations to help prevent impersonation, but this is not the case for bot accounts.

Mitigations:

- `BOT` tag is used everywhere in the UI where bot accounts are referenced, including messages and user lists.
- For Direct Message channels, the channel header distinguishes the bot from a regular user account with a `BOT` tag.

### What happens when a user who owns bot accounts is disabled?

By default, bot accounts managed by the deactivated user are disabled for enhanced security. Those with permissions to manage bot accounts can re-enable them via the **Product menu > Integrations > Bot Accounts**.

We strongly recommend creating new tokens for the bot, to ensure the user who was deactivated no longer has access to read or write data in the system via the bot access token.

If you prefer to have bot accounts remain enabled after user deactivation, set `DisableBotsWhenOwnerIsDeactivated` to `false` in your `config.json` file.

### Can bot accounts edit messages through the RESTful API?

Yes. By default, bot accounts can update their own posts.

If you find yourself unable to edit posts as a bot, check the following:

1. Instead of using a slash command to respond directly, use an an API call for the initial interaction with a user to enable message edits.
2. If your system is using [advanced permissions](https://docs.mattermost.com/onboard/advanced-permissions.html), then post edits could be disabled for users.

If neither of the above help resolve your issue, you also have the option to choose what role the bot account has. If System Admin is chosen, then the bot can update any posts in the system. Note that giving the System Admin role to a bot account enables the bot with other System Admin privileges so this should be done with care.

### If AD/LDAP or SAML synchronization is enabled, do bot accounts need to have an associated email address in AD/LDAP or SAML?

When AD/LDAP or SAML synchronization is enabled, you can create bot accounts using the steps outlined above. These bot accounts won't require an email address.

If you need to sync service accounts from AD/LDAP or SAML to Mattermost and use them as bot accounts, [please reach out to us](https://mattermost.com/contact-us) to discuss in detail. You may not need to sync service accounts and use them as bot accounts to meet your use case.

### Do attribute-based access policies apply to bot accounts?

Yes. [Membership policies and permission policies](https://docs.mattermost.com/administration-guide/manage/admin/attribute-based-access-control) evaluate bot accounts the same way they evaluate users. A bot that's missing an attribute a rule checks, or has a value that doesn't match, is treated like any user who doesn't qualify. Give the bot the [attributes](#bot-attributes) it needs before adding it to channels or teams that use access policies.

### How are bot accounts identified in compliance exports?

As of v5.14, a field named `UserType` is added to Compliance Exports, including Global Relay, Actiance, and CSV. The field identifies whether a message was posted by a `user` or by a `bot` account.
