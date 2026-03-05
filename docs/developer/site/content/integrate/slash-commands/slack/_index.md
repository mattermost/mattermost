---
title: Slack compatibility
heading: Slack compatibility
weight: 40
---
Mattermost makes it easy to migrate integrations written for Slack to Mattermost.

## Translate Slack's data format to Mattermost

Mattermost automatically translates the data coming from Slack:

1. JSON responses written for Slack, that contain the following, are translated to Mattermost markdown and rendered equivalently to Slack:

    - `<>` to denote a URL link, such as `{"text": "<https://mattermost.com/>"}`.
    - `|` within a `<>` to define linked text, such as `{"text": "Click <https://mattermost.com/|here> for a link."}`.
    - `<userid>`  to trigger a mention to a user, such as `{"text": "<5fb5f7iw8tfrfcwssd1xmx3j7y> this is a notification."}`.
    - `<!channel>`, `<!here>`, or `<!all>` to trigger a mention to a channel, such as `{"text": "<!channel> this is a notification."}`.

2. Both the HTTP `POST` and `GET` request bodies sent to a web service are formatted the same as Slack's. This means your Slack integration's receiving function does not need change to be compatible with Mattermost.

## Known Slack compatibility issues

- Using `icon_emoji` to override the username is not supported.
- Referencing channels using `<#CHANNEL_ID>` does not link to the channel.
- `<!everyone>` and `<!group>` are not supported.
- Parameters `mrkdwn`, `parse`, and `link_names` are not supported (Mattermost always converts markdown and automatically links @mentions).
- Bold formatting supplied as `*bold*` is not supported (must be done as `**bold**`).
- Slack assumes default values for some fields if they are not specified by the integration, while Mattermost does not.
