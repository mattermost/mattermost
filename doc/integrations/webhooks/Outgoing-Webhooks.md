# Outgoing Webhooks

Outgoing webhooks allow external applications, written in the programming language of your choice--to receive HTTP POST requests whenever a user posts to a certain channel, with a trigger word at the beginning of the message, or a combination of both. If the external application responds appropriately to the HTTP request, as response post can be made in the channel where the original post occurred.

A couple key points:

- **Mattermost outgoing webhooks are Slack-compatible.** If you've used Slack's outgoing webhooks to create integrations, you can copy and paste that code to create Mattermost integrations. Mattermost automatically translates Slack's proprietary JSON payload format into markdown to render in Mattermost messages
- **Mattermost outgoing webhooks support full markdown.** When an integration responds with a message to post, it will have access to a rich range of formatting unavailable in Slack that is made possible through [markdown support](../../usage/Markdown.md) in Mattermost. This includes headings, formatted fonts, tables, inline images and other options supported by [Mattermost Markdown]

_Example:_

Suppose you had an external application that recieved a post event whenever a message starting with `#build`. If a user posted the message `#build Let's see the status`, then the external application would receive an HTTP POST with data about that message. The application could then respond with a table of total tests run and total tests failed by component category, with links to failed tests by category. An example response might be:
```
{"text": "
---
##### Build Break - Project X - December 12, 2015 - 15:32 GMT +0
| Component  | Tests Run   | Tests Failed                                   |
|:-----------|:------------|:-----------------------------------------------|
| Server     | 948         | :white_check_mark: 0                           |
| Web Client | 123         | :warning: [2 (see details)](http://linktologs) |
| iOS Client | 78          | :warning: [3 (see details)](http://linktologs) |
---
"}
```
Which would render in a Mattermost message as follows:

---
##### Build Break - Project X - December 12, 2015 - 15:32 GMT +0
| Component  | Tests Run   | Tests Failed                                   |
|:-----------|:------------|:-----------------------------------------------|
| Server     | 948         | :white_check_mark: 0                           |
| Web Client | 123         | :warning: [2 (see details)](http://linktologs) |
| iOS Client | 78          | :warning: [3 (see details)](http://linktologs) |
---

### Enabling Outgoing Webhooks
Outgoing webhooks are off by default, and can be enabled by the system administrator. If you are the system administrator you can enable them by doing the following:

1. Login to your Mattermost team account that has the system administrator role.
1. Enable outgoing webhooks from **System Console -> Service Settings**.
1. (Optional) Configure the **Enable Overriding of Usernames from Webhooks** option to allow external applications to post messages under any name. If not enabled, the username of the creator of the webhook URL is used to post messages.
2. (Optional) Configure the **Enable Overriding of Icon from Webhooks** option to allow external applciations to change the icon of the account posting messages. If not enabled, the icon of the creator of the webhook URL is used to post messages.

### Set Up an Outgoing Webhook
Once outgoing webhooks are enabled, you will be able to set one up through the Mattermost UI. You will need to know the following

1. The channel (if not all of them) you want to listen to post events from
2. The trigger words (if any) that will trigger a post event if they are the **first word** of the post
3. The URL you want Mattermost to report the events to

Once you have those, you can follow these steps to set up your webhook:

1. Login to your Mattermost team site and go to **Account Settings -> Integrations**
2. Next to **Outgoing Webhooks** click **Edit**
3. Under **Add a new outgoing webhook** select your options
 1. Select a channel from the **Channel** dropdown to only report events from a certain channel (optional if Trigger Words selected)
 2. Enter comma separated words into **Trigger Words** to only report events from posts that start with one of those words (optional if **Channel** selected)
 3. Enter new line separated URLs that the post events will be sent too
4. Click **Add** to add your webhook to the system
5. Your new outgoing webhook will be displayed below with a **Token** that any external application that wants to listen to the webhook should ask for in it's instructions

### Creating Integrations using Outgoing Webhooks

If you'd like to build your own integration that uses outgoing webhooks, you can follow these general guidelines:

1. In the programming language of your choice, write your integration to perform what you had in mind
 1. Your integration should have a function for receiving HTTP POSTs from Mattermost that look like this example:
  ```
    Content-Length: 244
    User-Agent: Go 1.1 package http
    Host: localhost:5000
    Accept: application/json
    Content-Type: application/x-www-form-urlencoded

    channel_id=hawos4dqtby53pd64o4a4cmeoo&
    channel_name=town-square&
    team_domain=someteam&
    team_id=kwoknj9nwpypzgzy78wkw516qe&
    text=some text here&
    timestamp=1445532266&
    token=zmigewsanbbsdf59xnmduzypjc&
    trigger_word=some&
    user_id=rnina9994bde8mua79zqcg5hmo&
    user_name=somename
  ```
 2. Your integration must have a configurable **MATTERMOST_TOKEN** variable that is the Token given to you when you set up the outgoing webhook in Mattermost as decribed in the previous section _Set Up an Outgoing Webhook_. This configurable **MATTERMOST_TOKEN** must match the token in the request body so your application can be sure the request came from Mattermost
 3. If you want your integration to post a message back to the same channel, it can respond to the HTTP POST request from Mattermost with a JSON response body similar to this example:
  ```
  {
    "text": "This is some response text."
  }
  ```
3. Set up your integration running on Heroku, an AWS server or a server of your own to start getting real time post events from Mattermost channels

Additional Notes:

1. With **Enable Overriding of Usernames from Webhooks** turned on,  you can also override the username the message posts as by providing a `username` parameter in your JSON payload. For example, you might want your message looking like it came from a robot so you can use the JSON response ```{"username": "robot", "text": "Hello, this is some text."}``` to change the username of the post to robot. Note, to combat any malicious users from trying to use this to perform [phishing attacks](https://en.wikipedia.org/wiki/Phishing) a `BOT` indicator appears next to posts coming from webhooks

2. With **Enable Overriding of Icon from Webhooks** turned on, you can similarly change the icon the message posts with by providing a link to an image in the `icon_url` parameter of your JSON response. For example, ```{"icon_url": "http://somewebsite.com/somecoolimage.jpg", "text": "Hello, this is some text."}``` will post using whatever image is located at `http://somewebsite.com/somecoolimage.jpg` as the icon for the post

3. Also, as mentioned previously, [markdown](../../usage/Markdown.md) can be used to create richly formatted payloads, for example: ```payload={"text": "# A Header\nThe _text_ below **the** header."}``` creates a messages with a header, a carriage return and bold text for "the"

4. Just like regular posts, the text will be limited to 4000 characters at maximum

### Slack Compatibility

As mentioned above, Mattermost makes it easy to take integrations written for Slack's proprietary JSON payload format and repurpose them to become Mattermost integrations. The following automatic translations are supported:

1. The HTTP POST request body is formatted the same as Slack's, which means your Slack integration's receiving function should not need to change at all to be compatible with Mattermost
2.  JSON responses designed for Slack using `<>` to note the need to hyperlink a URL, such as ```{"text": "<http://www.mattermost.com/>"}```, are translated to the equivalent markdown in Mattermost and rendered the same as you would see in Slack
3. Similiarly, responses designed for Slack using `|` within a `<>` to define linked text, such as ```{"text": "Click <http://www.mattermost.com/|here> for a link."}```, are also translated to the equivalent markdown in Mattermost and rendered the same as you would see in Slack

To see samples and community contributions, please visit <http://mattermost.org/webhooks>.

#### Known Issues in v1.1

- Overriding of usernames does not yet apply to notifications
- Cannot supply `icon_emoji` to override the message icon
