---
title: "Frequently asked questions (FAQ)"
heading: "Frequently asked questions (FAQ)"
description: "Frequently asked questions"
weight: 80
aliases:
  - /integrate/admin-guide/
---
### What's the difference between incoming and outgoing webhooks?

A webhook is a way for one app to send real-time data to another app.

In Mattermost, incoming webhooks receive data from external applications and make a post in a specified channel. They're great for setting up notifications when something happens in an external application.

Outgoing webhooks take data from Mattermost, and send it to an external application. Then the outgoing webhook can post a response back in Mattermost. They're great for listening in on channels, and then notifying external applications when a trigger word is used.

### What is a slash command?

A slash command is similar to an outgoing webhook, but instead of listening to a channel it is used as a command tool. This means if you type in a slash command it will not be posted to a channel, whereas an outgoing webhook is only triggered by posted messages.

### What does Slack-compatible mean?

Slack compatible means that Mattermost accepts integrations that have a payload in the same format as Slack.

If you have a Slack integration, you should be able to set it up in Mattermost without changing the format.

### What if I have a webhook from somewhere other than Slack?

If you have an integration that outputs a payload in a different format you need to write an intermediate application to act as a translation layer to change it to the format Mattermost uses. Since there’s currently no general standard for webhook formatting, this is unavoidable and just a part of how webhooks work.

If there's no translation layer, Mattermost won't understand the data you're sending.

### What are attachments?

When "attachments" are mentioned in the integrations documentation, it refers to Slack's Message Attachments. These "attachments" can be optionally added as an array in the data sent by an integration, and are used to customize the formatting of the message.

We currently don't support the ability to attach files to a post made by an integration.

### Where can I find existing integrations?

{{< newtabref href="https://mattermost.com/marketplace/" title="Visit our app directory" >}} for dozens of open source integrations to common tools like Jira, Jenkins, GitLab, Trac, Redmine, and Bitbucket, along with interactive bot applications (Hubot, mattermost-bot), and other communication tools (Email, IRC, XMPP, Threema) that are freely available for use and customization.

### Where should I install my integrations?

For self-hosted deployments in small setups you might host integrations on the same server on which Mattermost is installed. For larger deployments you can setup a separate server for integrations, or add them to the server on which the external application is hosted - for example, if you're self-hosting a Jira server you could deploy a Jira integration on the Jira server itself.

When self-hosting restrictions are less strict, AWS, Heroku, and other public cloud options could also be used.

### How do I create a bot account with personal access tokens?

See [bot accounts documentation]({{< ref "/integrate/reference/bot-accounts" >}}) to learn more about how to create and manage bot accounts in Mattermost.

### How do I create a bot account without personal access tokens or webhooks?

Deployments that cannot create bot accounts via webhooks due to security reasons and do not want to use [personal access tokens]({{< ref "/integrate/reference/personal-access-token" >}}) with no expiry time, can use the following approach:

1. Create a bot account using a secure email and strong password.
2. Manually add the account to all teams and channels it needs access to. If your deployment has a lot of teams or channels, you may create a CLI script to automate the process.
   - In a testing environment, you may also make the bot account a System Admin, giving the bot permissions to post to any channel. Not recommended in production due to potential security vulnerabilities.
3. Provide the email and password to your integration, and store it in a secure location with restricted access.
4. Have your integration use the email and password with an {{< newtabref href="https://api.mattermost.com/v4/#tag/authentication" title="`/api/v4/login`" >}} endpoint to retrieve a session token. The session token is used to authenticate to the Mattermost system.
   - Set up your bot to make an HTTP POST to `your-mattermost-url.com/api/v4/users/login` with a JSON body, including the bot account's email and password.

     ```http request
     POST /api/v4/users/login HTTP/1.1
     Host: your-mattermost-url.com
     Content-Length: 66
     Content-Type: application/json

     {"login_id":"someone@nowhere.com","password":"thisisabadpassword"}
     ```

     where we assume there is a Mattermost instance running at http://localhost:8065.
   - If successful, the response will contain a `Token` header and a user object in the body:

     ```http request
     HTTP/1.1 200 OK
     Set-Cookie: MMSID=hyr5dmb1mbb49c44qmx4whniso; Path=/; Max-Age=2592000; HttpOnly
     Token: hyr5dmb1mbb49c44qmx4whniso
     X-Ratelimit-Limit: 10
     X-Ratelimit-Remaining: 9
     X-Ratelimit-Reset: 1
     X-Request-Id: smda55ckcfy89b6tia58shk5fh
     X-Version-Id: developer
     Date: Fri, 11 Sep 2015 13:21:14 GMT
     Content-Length: 657
     Content-Type: application/json; charset=utf-8

     {{user object as json}}
     ```

    The bot should retrieve the session token from the `Token` header and store it in memory for use with future requests.

   {{<note "Note:">}}
   Each session token has an expiry time, set depending on the server's configuration. If the session token your bot is using expires, it will receive a `401 Unauthorized` response from requests using that token. When your bot receives this response, it should reapply the login logic (using the    above steps) to get another session token. Then resend the request that received the `401` status code.
   {{</note>}}

5. Include the `Token` as part of the `Authorization` header on API requests from your integration.
   - To confirm the token works, you can have your bot make a simple `GET` request to `/api/v4/users/me` with the `Authorization: bearer <yourtokenhere>` in the header. If it returns a `200` with the bot's user object in the response, the API request was made successfully.

     ```http request
     GET /api/v4/users/me HTTP/1.1
     Authorization: bearer <yourtokenhere>
     Host: your-mattermost-url.com
     ```

{{<note "Note:">}}
The Mattermost development team is also working on an {{< newtabref href="https://docs.google.com/document/d/1ey4eNQmwK410pNTvlnmMWTa1fqtj8MV4d9XkCumI384" title="API developer token" >}}, which allows you to authenticate the bot account via the API token rather than retrieving a session token from a user account.
{{</note>}}

### How should I automate the install and upgrade of Mattermost when included in another application?

Automate Mattermost installation within another application:

1. Review the {{< newtabref href="https://docs.mattermost.com/guides/install-deploy-upgrade-scale.html#install-mattermost" title="Mattermost installation documentation" >}} to understand configuration steps of the production deployment.
2. Install Mattermost files to a dedicated `/opt/mattermost` directory by decompressing the `tar.gz` file of the latest release for your target platform (for example `linux-amd64`).
3. Review {{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html" title="Configuration Settings" >}} in `config.json` and set your automation to customize your Mattermost deployment based on your requirements.
4. For directory locations defined in `config.json`, such as the location of the local file storage directory (`./data/`) or logs directory (`./logs`), you can redefine those locations in your `config.json` settings and move the directories.
   - All other directories should remain as they are in `/mattermost`.
5. Test that your Mattermost server is running with your new configuration.
6. Also, from the command line run `./bin/mattermost -version` to test that the command line interface is functioning properly.

Automate Mattermost upgrade within another application:

1. Review the {{< newtabref href="https://docs.mattermost.com/upgrade/upgrading-mattermost-server.html" title="upgrade guide" >}} for an overview of the upgrade procedure.
2. Create automation to upgrade to the next Mattermost versions:
    - Back up the `config.json` file to preserve any settings a user may have made.
    - Back up the `./data` directory if local storage is used for files.
    - Replace the contents of `/mattermost` directory with the decompressed contents of the latest release.
    - Restore `config.json` and `./data` to their previous locations (which may have been overwritten).
    - If you need to overwrite any `config.json` parameters use a {{< newtabref href="https://stackoverflow.com/questions/20568515/how-to-use-sed-to-replace-a-config-files-variable" title="`sed` command" >}} or similar tool to update `config.json`
    - Starting the Mattermost server to upgrade the database, `config.json` file, and `./data` as necessary.
3. Optionally the upgrade procedure can be chained so users can upgrade across an arbitrary number of Mattermost versions rather than to just the latest release.

Come {{< newtabref href="https://community.mattermost.com/core/channels/tickets" title="join our Contributors community channel" >}} on our daily build server, where you can discuss questions with community members and the Mattermost core team. Join our {{< newtabref href="https://community.mattermost.com/core/channels/developers" title="Developers channel" >}} for technical discussions and our {{< newtabref href="https://community.mattermost.com/core/channels/integrations" title="Integrations channel" >}} for all integrations and plugins discussions.
