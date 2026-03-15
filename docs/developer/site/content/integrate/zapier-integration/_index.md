---
title: "Integrate with Zapier"
heading: "Integrate with Zapier"
description: "Zapier is a service that automates tasks between web apps."
weight: 100
aliases:
  - /integrate/admin-guide/admin-zapier-integration/
---

You can create "zaps" that contain a trigger and an action for a task that you want to perform repeatedly. Zapier regularly checks your trigger for new data and automatically performs the action for you.

Using Zapier you can integrate over 700 apps into Mattermost, including {{< newtabref href="https://zapier.com/apps/email-parser/integrations" title="Email" >}}, {{< newtabref href="https://zapier.com/apps/github/integrations" title="GitHub" >}}, {{< newtabref href="https://zapier.com/apps/jira/integrations" title="Jira" >}}, {{< newtabref href="https://zapier.com/apps/wufoo/integrations" title="Wufoo" >}}, {{< newtabref href="https://zapier.com/apps/salesforce/integrations" title="Salesforce" >}}, {{< newtabref href="https://zapier.com/apps/gmail/integrations" title="Gmail" >}}, and {{< newtabref href="https://zapier.com/apps" title="many more" >}}.

## Zapier setup guide

Zapier is authorized using OAuth2.0. The setup guide requires that a System Admin register the Zapier app on their Mattermost server and can then optionally allow any users with a Zapier account to create integrations.

### Enable Zapier

The first time you set up Zapier on your Mattermost instance you'll be required to enable an OAuth 2.0 application which can be used by everyone on your server. Your System Admin must execute these steps.

To learn more about OAuth 2.0 applications, including what permissions they have access to, see the [OAuth 2.0 documentation]({{< ref "/integrate/apps/authentication/oauth2" >}}).

#### Enable OAuth 2.0

1. Open **Product menu > System Console**.
2. Under **Integrations > Integration Management**:
    - Set {{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html#enable-oauth-2-0-service-provider" title="Enable OAuth 2.0 Service Provider" >}} to **True**.
    - If you’d like to allow Zapier integrations to post with customizable usernames and profile pictures, then set {{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html#enable-integrations-to-override-usernames" title="Enable integrations to override usernames" >}} and {{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html#enable-integrations-to-override-profile-picture-icons" title="Enable integrations to override profile picture icons" >}} to **True**.

#### Register Zapier as an OAuth 2.0 application

1. Go to **Product menu > Integrations**.
2. Select **OAuth 2.0 Applications > Add OAuth 2.0 Application** and enter the following fields:
   - **Is Trusted:** No
   - **Display Name:** `Zapier`
   - **Description:** `Application for Zapier integrations`
   - **Homepage:** `https://zapier.com/`
   - **Icon URL:** `https://cdn.zapier.com/zapier/images/logos/zapier-logomark.png`
   - **Callback URLs:** `https://zapier.com/dashboard/auth/oauth/return/MattermostDevAPI/`
3. Select **Save** to create the application.

You'll be provided with a **Client ID** and **Client Secret**. Save these values, or share them with your team to connect Zapier in the steps below.

![image](zapier-oauth.png)

### Create a Zap

1. {{< newtabref href="https://zapier.com/sign-up" title="Sign up" >}} for a free Zapier account or {{< newtabref href="https://zapier.com/app/login" title="log in" >}} if you already have one.
2. On your {{< newtabref href="https://zapier.com/app/dashboard" title="Zapier dashboard" >}} select **Make a Zap!**.
3. **Trigger App**: Events in this app will trigger new messages in Mattermost.
   - **Select a Trigger App:** This will trigger new messages in Mattermost. If the app you’re looking to connect isn’t supported on Zapier, consider firing in-app events to a Gmail account and then connecting Gmail to Mattermost using Zapier.
   - **Select the Trigger Event:** New messages in Mattermost will fire depending on these selected events in conjunction with any filters you apply.
   - **Connect the Trigger Account:** Connect the account from which you’d like to trigger events and **Test** it to ensure Zapier can connect successfully.
4. **Filtering:** (Optional) Exclude certain events from triggering new messages. Learn more about using {{< newtabref href="https://help.zapier.com/hc/en-us/articles/8496276332557" title="Zapier custom filtering" >}}.
   - Add a filter by selecting the small **+** icon before the **Action** step.
   - Zapier supports **AND** and **OR** filters. Use the dropdown selectors to choose what events will allow the trigger to send a Mattermost message.
5. **Mattermost Action:** Connect your Mattermost Account and then specify posting details.
   - **Select the Action App:** Search for “Mattermost”.
   - **Select the Action Event:** Select **Post a Message**. The Mattermost team plans to expand the actions available here.
   - **Connect the Action Account:** Select **Connect a New Account** and enter the following fields:
     - **Mattermost URL:** This is the URL you use to access your Mattermost site. Don't include a slash at the end of the URL and don't append a team to the end of the server URL. For example, `https://community.mattermost.com/core` is the entire URL to the Contributors team on our community server. The **Mattermost URL** entered here would be `https://community.mattermost.com`.
     -  **Client ID/Secret:** If Zapier has been enabled as an OAuth application as per the steps above, then these values can be found by navigating to one of your Mattermost teams, then **Product menu > Integrations > OAuth 2.0 Applications**. Select **Show Secret** next to the Zapier app, then obtain the Client ID and Client Secret.
     -  **Log in to Mattermost:** After completing the above fields you will be prompted to log in to your Mattermost account if you're not logged in already. If you’re having trouble connecting then please read our troubleshooting guide.
     -  You'll then be prompted to allow Zapier to access your Mattermost account. Select **Allow**.
      - **Message Post Details:** Specify the formatting of the messages and the team/channel where messages will be posted.
      - **Team:** Choose the team where new messages will post. The dropdown should contain all teams you have access to on Mattermost.
      - **Channel:** Choose the channel where new messages will post. The dropdown contains all channels that you belong to. Zapier cannot post into Direct Message channels.
     - **Message Text:** Enter the message text that will post to Mattermost. This text can be formatted using {{< newtabref href="https://docs.mattermost.com/messaging/formatting-text.html#formatting-text" title="Markdown" >}} and include the dynamic fields offered by your selected trigger app. Read our message formatting tips below.

       ![image](zapier-dynamic-fields.png)

6. **Username:** This is the username that Zapier will post as. Zapier integrations will always appear with a `BOT` tag next to the username. In order for bots to override the username of the authorized user, your System Admin must set {{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html#enable-integrations-to-override-usernames" title="Enable integrations to override usernames" >}} to **True**.
7. **Icon URL:** This is the profile picture of the bot that Zapier will post as. In order for bots to override the profile picture of the authorized user, your System Admin must set {{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html#enable-integrations-to-override-profile-picture-icons" title="Enable integrations to override profile picture icons" >}} to **True**.
8. **Test the Zap:** You may want to test your zap formatting in a Private Channel before posting in a channel that is visible to your entire team.

## Message formatting tips

Here are some useful tips we recommend to get the most out of Zapier integration:

- **Markdown:** Mattermost supports the use of {{< newtabref href="https://docs.mattermost.com/end-user-guide/collaborate/format-messages.html#use-markdown" title="Markdown" >}} in Zapier integrations. For example, use {{< newtabref href="https://docs.mattermost.com/messaging/formatting-text.html#headings" title="heading markdown" >}} for Jira issue titles.
- **Custom Icons:** Use different icons for different services and Zapier integrations.
- **Hashtags:** Use hashtags to make your Zapier posts searchable. Use different hashtags for different services and Zapier integrations. For example, use the dynamic fields available in Zapier to include ticket a Jira ticket number in hashtags. This makes all conversation on a specific ticket instantly searchable by selecting the hashtag.
- **Quick Links:** Link back to the service that fired the zap through the use of Markdown {{< newtabref href="https://docs.mattermost.com/messaging/formatting-text.html#links" title="embedded links" >}}. For example, in our zaps we embed a link back to the service within the timestamp so it’s easy to take action on any zap.

### Examples

The Mattermost team has over 50 zaps integrated on our {{< newtabref href="https://community.mattermost.com/core" title="Community Contributors tem" >}} used for internal communication and interacting with contributors. The {{< newtabref href="https://community.mattermost.com/core/channels/community-heartbeat" title="Community Heartbeat channel" >}} integrates all our community services in one accessible location. These zaps are formatted in two ways depending on the service:

**GitHub Issues and Comments, UserVoice Suggestions and Comments, GitLab MM Issues, GitLab Omnibus MM Issues**

```md
#### [Title of issue]

#[searchable-hashtag] in [external service](link to service) by [author](link to author profile) on [time-stamp](link to specific issue or comment)

[Body of issue or comment]
```

![image](zapier-ch1.png)

**Forum Posts, Jira Comments, Hacker News Mentions, Tweets**

```md
> [forum post, media mention, or tweet]

#[searchable-hashtag] in [external service](link to service) by [author](link to author profile) on [time-stamp](link to specific forum post, media mention or tweet)
```

![image](zapier-ch2.png)

## Troubleshooting guide

Possible solutions to common issues encountered during setup.

### Cannot connect a Mattermost account

1. `"Token named access_token was not found in oauth response!"`
  a. Possible Solution: Try removing any trailing `/`'s on the end of your **Mattermost URL**.
    - Correct: `https://community.mattermost.com`
    - Incorrect: `https://community.mattermost.com/`

   ![image](zapier-error1.png)

2. `"[Server URL] returned (404)"`
  a. Possible Solution: The **Mattermost URL** cannot have a team appended to the end of the server URL.
    - Correct: `https://community.mattermost.com`
    - Incorrect: `https://community.mattermost.com/core`

   ![image](zapier-error2.png)

3. `"[Server URL] returned (500) Internal Server Error"`
  a. Possible Solution: The **Client Secret** might be incorrect. Verify this value by selecting **Integrations > OAuth 2.0 Applications** from the Product menu, or check with your System Admin.

   ![image](zapier-error4.png)

4. `"Error Invalid client id"`
  a. Possible Solution: The **Client ID** and/or **Client Secret** might have trailing spaces in them when copied and pasted into the form. Verify there are no trailing spaces in the **Client ID** and **Client Secret** fields then try again.

   ![image](zapier-trailing-space-error.png)

5. `"Mattermost needs your help: We couldn't find the requested app"`
  a. Possible Solution: The **Client ID** might be incorrect. Verify this value by selecting **Integrations > OAuth 2.0 Applications** from the Product menu, or check with your System Admin.

   ![image](zapier-error3.png)

### Deauthorize the Zapier app

If you'd like to deauthorize Zapier so it can no longer post through your connected account, select your avatar, then select **Profile > Security > OAuth 2.0 Applications**, then select **Deauthorize** on the Zapier app.
