---
title: "Personal access tokens"
heading: "Personal access tokens"
description: "Personal access tokens function similar to session tokens and can be used by integrations to authenticate against the Mattermost REST API. It is the most commonly used type of token for integrations."
weight: 20
aliases:
  - /integrate/admin-guide/admin-personal-access-token/
---
Personal access tokens function similar to session tokens and can be used by integrations to {{< newtabref title="authenticate against the REST API." href="https://api.mattermost.com/#tag/authentication" >}} It is the most commonly used type of token for integrations.

## Create a personal access token

1. Enable personal access tokens in **System Console > Integrations > Integration Management**.

    ![Enable Access Token Settings under Integration Management using the System Console.](access_token_enable.png)

2. Identify the account you want to create a personal access token with. You may optionally create a new user account for your integration, such as for a bot account. By default, only System Admins have permissions to create a personal access token.
3. To create an access token with a non-admin account, you must first give it the appropriate permissions. Go to **System Console > User Management > Users**, search for the user account, then select **Manage Roles** from the dropdown.

    ![Apply appropriate Access Token permission through Manage Roles section under User Management using the System Console.](access_token_manage_roles.png)

4. Select **Allow this account to generate personal access tokens.**

    ![Provide additional Roles to the user using the User Management section in the System Console](access_tokens_additional_roles.png)

    You may optionally allow the account to post to any channel in your Mattermost server, including direct messages by choosing the **post:all** role. **post:channels** role allows the account to post to any public channel in the Mattermost server.

    Then select **Save**.

5. Sign in to the user account to create a personal access token.
6. Go to **Profile > Security > Personal Access Tokens**, then select **Create Token**.

    ![Create a Access Token in the Security tab under the Profile Menu.](access_token_create.png)

7. Enter a description for the token, so you remember what it's used for. Then select **Save**.

    ![Save the Access Token with a description.](access_token_save.png)

    {{<note "Note:">}} If you create a personal access token for a System Admin account, be extra careful who you share it with. The token enables a user to have full access to the account, including System Admin privileges. It's recommended to create a personal access token for non-admin accounts.
    {{</note>}}

8. Copy the access token now for your integration and store it in a secure location. You won't be able to see it again!
9. You're all set! You can now use the personal access token for integrations to interact with your Mattermost server and {{< newtabref title="authenticate against the REST API" href="https://api.mattermost.com/#tag/authentication" >}}.

    ![Find details about the Access Token on the Personal Access Token section in the Security tab of your Profile.](access_token_settings.png)

## Revoke a personal access token

A personal access token can be revoked by deleting the token from either the user's profile settings or from the System Console. Once deleted, all sessions using the token are deleted, and any attempts to use the token to interact with the Mattermost server are blocked.

Tokens can also be temporarily deactivated from the user's profile. Once deactivated, all sessions using the token are deleted, and any attempts to use the token to interact with the Mattermost server are blocked. However, the token can be reactivated at any time.

### User's profile

1. Sign in to the user account, select the user avatar, then select **Profile > Security > Personal Access Tokens**.
2. Identify the access token you want to revoke, then select **Delete** and confirm the deletion.

    ![Delete a Access Token through the Security tab under the Profile section.](access_token_delete_from_profile.png)

### System Console

1. Go to **System Console > User Management > Users**, search for the user account which the token belongs to, then select **Manage Tokens** from the dropdown.
2. Identify the access token you want to revoke, then select **Delete** and confirm the deletion.

    ![Delete a Access Token using the Manage Tokens section under User Management in the System Console.](access_token_delete_from_console.png)

## Frequently asked questions (FAQ)

### How do personal access tokens differ from regular session tokens?

- Personal access tokens do not expire. As a result, you can more easily integrate with Mattermost, bypassing the {{< newtabref href="https://docs.mattermost.com/configure/environment-configuration-settings.html#session-lengths" title="session length limits set in the System Console" >}}.
- Personal access tokens can be used to authenticate against the API more easily, including with AD/LDAP and SAML accounts.
- You can optionally assign additional roles for the account creating personal access tokens. This lets the account post to any channel in Mattermost, including direct messages.

Besides the above differences, personal access tokens are exactly the same as regular session tokens. They are cryptic random IDs and are not different from a user's regular session token created after logging in to Mattermost.

### Can I set personal access tokens to expire?

Not in Mattermost, but you can automate your integration to cycle its token {{< newtabref title="through the REST API" href="https://api.mattermost.com/#operation/CreateUserAccessToken" >}}.

### How do I identify a badly behaving personal access token?

The best option is to go to **System Console > Logs** and finding error messages relating to a particular token ID. Once identified, you can search which user account the token ID belongs to in **System Console > Users** and revoke it through the **Manage Tokens** dropdown option.

### Do personal access tokens continue to work if the user is deactivated?

No. The session used by the personal access token is revoked immediately after a user is deactivated, and a new session won't be created. The tokens are preserved and continue to function if the user account is re-activated. This is useful when a bot account is temporarily deactivated for troubleshooting, for instance.
