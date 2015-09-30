# Incoming Webhooks

With incoming webhooks practically any external source - once given a URL by you - can post a message to any channel you have access to. This is done through a HTTP POST request with a simple JSON payload. The payload can contain some text, and some simple options to allow the external source to customize the post.

## Creating the Webhook URL

To get the incoming webhook URL - where all the HTTP requests will be sent - follow these steps:

1. Login to your Mattermost account.
2. Open the menu by clicking near your profile picture in the top-left and open Account Settings.
3. Go to the Integrations tab and click the 'Edit' button next to 'Incoming Webhooks'.
4. Use the selector to choose a channel and click the 'Add' button to create the webhook.
5. Your webhook URL will be displayed below in the 'Existing incoming webhooks' section.


## Posting a Message

You can send the message by including a JSON string as the `payload` parameter in a HTTP POST request.
```
payload={"text": "Hello, this is some text."}
```

In addition, if `Content-Type` is specified as `application/json` in the headers of the HTTP request then the body of the request can be direct JSON.
```
{"text": "Hello, this is some text."}
```

It is also possible to post richly formatted messages using [Markdown](../../help/enduser/markdown.md).
```
payload={"text": "# A Header\nThe _text_ below **the** header."}
```

Just like regular posts, the text will be limited to 4000 characters at maximum.

## Adding Links

In addition to including links in the standard Markdown format, links can also be specified by enclosing the URL in `<>` brackets
```
payload={"text": "<http://www.mattermost.com/>"}
```

They can also include a `|` character to specify some clickable text.
```
payload={"text": "Click <http://www.mattermost.com/|here> for a link."}
```

## Channel Override

You can use a single webhook URL to post messages to different channels by overriding the channel. You can do this by adding the channel name - as it is seen in the channel URL - to the request payload.
```
payload={"channel": "off-topic", "text": "Hello, this is some text."}
```

## Finishing up

Combining everything above, here is an example message made using a curl command:

```
curl -i -X POST 'payload={"channel": "off-topic", "text": "Hello, this is some text."}' http://yourmattermost.com/hooks/xxxxxxxxxxxxxxxxxxxxxxxxxx
```

A post with that text will be made to the Off-Topic channel.
