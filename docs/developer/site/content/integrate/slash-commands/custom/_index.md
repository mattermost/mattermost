---
title: Custom commands
heading: Custom slash commands
weight: 20
---
Suppose you want to write an external application that is able to check the weather for certain cities. By creating a custom slash command and setting up the application to handle the HTTP `POST` or `GET` from the command, you can let your users check the weather in their city for the week using your command, say `/weather toronto week`.

You can follow these general guidelines to set up a custom Mattermost slash command for your application.

1. Open **Product menu > Integrations > Slash Commands**. If you don't have the **Integrations** option in your Main Menu, slash commands may not be enabled on your Mattermost Server or may be disabled for non-admins. Enable them from **System Console > Integrations > Integration Management** or ask your Mattermost System Admin to do so.

2. Select **Add Slash Command**; the **Add** dialog will appear. Use the following guidelines to configure the slash command:

    - Set the **Title** and **Description** for the command.
    - Set the **Command Trigger Word**. The trigger word must be unique and cannot begin with a slash or contain any spaces. It also cannot be one of the [built-in commands]({{< ref "/integrate/slash-commands/built-in" >}}).
    - Set the **Request URL** and **Request Method**. The request URL is the endpoint that Mattermost hits to reach your application, and the request method is either `POST` or `GET` and specifies the type of request sent to the request URL.
    - (_Optional_) Set the **Response Username** and **Response Icon** the command will post messages as in Mattermost. If not set, the command will use your username and profile picture.
    - (_Optional_) Select the **Autocomplete** option to include the slash command in the command autocomplete list, displayed when typing ``/`` in an empty input box. Use it to make your command easier to discover by your teammates. You can also provide a hint listing the arguments of your command and a short description displayed in the autocomplete list.

      {{<note "Note:">}}
   {{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html#enable-integrations-to-override-usernames" title="Enable integrations to override usernames" >}} must be set to `true` in `config.json` to override usernames. Enable them from **System Console > Integrations > Integration Management**, or ask your System Admin to do so. If not enabled, the username is set to `webhook`.

   Similarly, {{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html#enable-integrations-to-override-profile-picture-icons" title="Enable integrations to override profile picture icons" >}} must be set to `true` in `config.json` to override profile picture icons. Enable them from **System Console > Integrations > Integration Management**, or ask your System Admin to do so. If not enabled, the icon of the creator of the webhook URL is used to post messages.
      {{</note>}}

3. Select **Save**. On the next page, copy the **Token** value. This will be used in a later step.

   ![image](slash_commands_token.png)

4. Next, write your external application. Include a function which receives HTTP `POST` or HTTP `GET` requests from Mattermost. The request will look something like this:

    ```http request
    POST /weather HTTP/1.1
    Host: weather-service:4000
    Accept: application/json
    Accept-Encoding: gzip
    Authorization: Token qzgakf1nx3yt9dr4n8585ihbxy
    Content-Length: 567
    Content-Type: application/x-www-form-urlencoded
    User-Agent: Mattermost-Bot/1.1
    
    channel_id=fukxanjgjbnp7ng383at53k1sy&
    channel_name=town-square&
    command=%2Fweather&
    response_url=http%3A%2F%2Flocalhost%3A8066%2Fhooks%2Fcommands%2Fi11f6nnfgfyk8eg56x9omc6dpa&
    team_domain=team-awesome&
    team_id=wx4zz8t4ttgmtxqiwfohijayzc&
    text=toronto+week&
    token=qzgakf1nx3yt9dr4n8585ihbxy&
    trigger_id=ZWZ5ZjRndzR4YmJxOHJlZWh4MXpkaHozbnI6ZXJqNnFjazNyZmd0dWpzODZ3NXI2cmNremg6MTY2MjA0MTY5Njg5NjpNRVFDSUQ5cTZ3MkRHU1RaNjhyaDh1TGl1STlSVHh2R1czSXZ5aGVRYjhkWThuZnlBaUI2YnlPR2ZpWlczR1FmVkdIODlreEp4MmlVT0UxMm9LMjlkZ1d0RC8xbjZRPT0%3D&
    user_id=erj6qck3rfgtujs86w5r6rckzh&
    user_name=alan
    ```

   If your integration sends back a JSON response, make sure it returns the `application/json` content-type.

5. The HTTP `POST` or `GET` request will contain an `Authorization` header with a bearer token. The bearer token should match the **Token** value from step 3 for a request to be considered valid. 

6. To have your application post a message back to `town-square`, it can respond to the HTTP `POST` or `GET` request with a JSON payload.
   
   Mattermost supports several [parameters](#response-parameters) in the response to fine-tune the user's experience. For instance, you can override the username and profile picture the messages post as, or specify a custom post type when sending a webhook message for use by [plugins]({{< ref "/integrate/plugins" >}}). Messages with advanced formatting can be created by including an [attachment array]({{< ref "/integrate/reference/message-attachments" >}}) and [interactive message buttons]({{< ref "/integrate/plugins/interactive-messages" >}}) in the response payload.

   Our external weather application could respond with a JSON payload like so:

   ```
   {"response_type": "in_channel", "text": "
     ---
     #### Weather in Toronto, Ontario for the Week of February 16th, 2016
    
     | Day                 | Description                      | High   | Low    |
     |:--------------------|:---------------------------------|:-------|:-------|
     | Monday, Feb. 15     | Cloudy with a chance of flurries | 3 °C   | -12 °C |
     | Tuesday, Feb. 16    | Sunny                            | 4 °C   | -8 °C  |
     | Wednesday, Feb. 17  | Partly cloudly                   | 4 °C   | -14 °C |
     | Thursday, Feb. 18   | Cloudy with a chance of rain     | 2 °C   | -13 °C |
     | Friday, Feb. 19     | Overcast                         | 5 °C   | -7 °C  |
     | Saturday, Feb. 20   | Sunny with cloudy patches        | 7 °C   | -4 °C  |
     | Sunday, Feb. 21     | Partly cloudy                    | 6 °C   | -9 °C  |
     ---
   "}
   ```

   The JSON response would render in Mattermost as:

   ![image](weatherBot.png)


## Response parameters

Slash command responses support more than just the `text` field. Here is a full list of supported parameters.

| Parameter            | Description                                                                                                                                                                                                                                                                                                                                          | Required                         |
|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------|
| `text`               | {{< newtabref href="https://docs.mattermost.com/messaging/formatting-text.html" title="Markdown-formatted" >}} message to display in the post.                                                                                                                                                                                                                                     | If `attachments` is not set, yes |
| `attachments`        | [Message attachments]({{< ref "/integrate/reference/message-attachments" >}}) used for richer formatting options.                                                                                                                                                                                                                                    | If `text` is not set, yes        |
| `response_type`      | Set to blank or `ephemeral` to reply with a message that only the user can see. <br/> Set to `in_channel` to create a regular message.<br/> Defaults to `ephemeral`.                                                                                                                                                                                 | No                               |
| `username`           | Overrides the username the message posts as.<br/> Defaults to the username set during webhook creation or the webhook creator's username if the former was not set.<br/> Must be enabled {{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html#enable-integrations-to-override-usernames" title="in the configuration" >}}.                        | No                               |
| `channel_id`         | Overrides the channel to which the message gets posted.<br/> Defaults to the channel in which the command was issued.                                                                                                                                                                                                                                | No                               |
| `icon_url `          | Overrides the profile picture the message posts with.<br/> Defaults to the URL set during webhook creation or the webhook creator's profile picture if the former was not set.<br/> Must be enabled {{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html#enable-integrations-to-override-profile-picture-icons" title="in the configuration" >}}. | No                               |
| `goto_location`      | A URL to redirect the user to. Supports many protocols, including `http://`, `https://`, `ftp://`, `ssh://` and `mailto://`.                                                                                                                                                                                                                         | No                               |
| `type`               | Sets the post `type`, mainly for use by plugins.<br/> If not blank, must begin with `custom_`. Passing `attachments` will ignore this field and set the type to `slack_attachment`.                                                                                                                                                                  | No                               |
| `extra_responses`    | An array of responses used to send more than one post in your response. Each item in this array takes the shape of its own command response, so it can include any of the other parameters listed here, except `goto_location` and `extra_responses` itself. Available from Mattermost v5.6.                                                         | No                               |
| `skip_slack_parsing` | If set to `true` Mattermost will skip the [Slack compatibility]({{< ref "/integrate/slash-commands/slack" >}}) handling. Useful if the post contains text or code which is incorrectly handled by the Slack compatibility logic. Available from Mattermost v5.20.                                                                                    | No                               |
| `props`              | Sets the post `props`, a JSON property bag for storing extra or meta data on the post. Mainly used by other integrations accessing posts through the {{< newtabref title="REST API" href="https://api.mattermost.com" >}}.<br/>The following keys are reserved: `from_webhook`, `override_username`, `override_icon_url` and `attachments`.          | No                               |

An response payload using several parameters could look like this:

```json
{
    "response_type": "in_channel",
    "text": "\n#### Test results for July 27th, 2017\n@channel here are the requested test results.\n\n| Component  | Tests Run   | Tests Failed                                   |\n| ---------- | ----------- | ---------------------------------------------- |\n| Server     | 948         | :white_check_mark: 0                           |\n| Web Client | 123         | :warning: 2 [(see details)](https://linktologs) |\n| iOS Client | 78          | :warning: 3 [(see details)](https://linktologs) |\n\t\t      ",
    "username": "test-automation",
    "icon_url": "https://mattermost.com/wp-content/uploads/2022/02/icon.png",
    "props": {
        "test_data": {
            "ios": 78,
            "server": 948,
            "web": 123
        }
    },
}
```

## Delayed and multiple responses

You can use the `response_url` parameter to supply multiple responses or a delayed response to a slash command. Response URLs can be used to send five additional messages within a 30-minute time period from the original command invocation.

Delayed responses are useful when the action takes more than three seconds to perform. For instance:
- Retrieval of data from external third-party services, where the response time may take longer than three seconds.
- Report generation, batch processing or other long-running processes that take longer than three seconds to respond.

Any requests that are made to the response URL should either be a plain text or JSON-encoded body. The JSON-encoded message supports both {{< newtabref href="https://docs.mattermost.com/messaging/formatting-text.html" title="Markdown formatting" >}} and [message attachments]({{< ref "/integrate/reference/message-attachments" >}}).

For information on the Slack compatibility of slash commands, see the [Slack compatibility]({{< ref "/integrate/slash-commands/slack" >}}) page.
