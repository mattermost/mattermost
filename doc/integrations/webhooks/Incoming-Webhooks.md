# Incoming Webhooks

Incoming webhooks allow external applications, written in the programming language of your choice--to post messages into Mattermost channels and private groups by sending a specifically formatted JSON payload via HTTP POST request to a secret Mattermost URL generated specifically for each application. 

A couple key points: 

- **Mattermost incoming webhooks are Slack-compatible.** If you've used Slack's incoming webhooks to create integrations, you can copy and paste that code to create Mattermost integrations. Mattermost automatically translates Slack's propretiary JSON payload format into markdown to render in Mattermost messages. 
- **Mattermost incoming webhooks support full markdown.** A rich range of formatting unavailable in Slack is made possible through [markdown support](../../usage/Markdown.md) in Mattermost, incuding headings, formatted fonts, tables, inline images and other options supported by [Mattermost Markdown].

_Example:_

Suppose you wanted to create a notification of the status of a daily build, with a table of total tests run and total tests failed by component category, with links to failed tests by category. You could create the following JSON payload to post to a Mattermost channel using webhooks: 

```
payload={"text": "
*** 
##### Build Break - Project X - December 12, 2015 - 15:32 GMT +0
| Component  | Tests Run   | Tests Failed                                   |
|:-----------|:------------|:-----------------------------------------------|
| Server     | 948         | :white_check_mark: 0                           |
| Web Client | 123         | :warning: [2 (see details)](http://linktologs) |
| iOS Client | 78          | :warning: [3 (see details)](http://linktologs) |
***
"}
```
Which would render in a Mattermost message as follows:

*** 
##### Build Break - Project X - December 12, 2015 - 15:32 GMT +0
| Component  | Tests Run   | Tests Failed |
|:------------ |:---------------|:-----|
| Server | 948       |  :white_check_mark: 0 |
| Web Client | 123              |   :warning: [2 (see details)](http://linktologs) |
| iOS Client | 78        |    :warning: [3 (see details)](http://linktologs) |
*** 

### Creating Integrations using Incoming Webhooks
You can create a webhook integration to post into Mattermost channels and private groups using these steps: 

1. Enable incoming webhooks from **System Console -> Service Settings**  

 1. Optionally configure the **Enable Overriding of Usernames from Webhooks** option to allow external applications to post messages under any name. If not enabled, the username of the creator of the webhook URL is used to post messages.
 2. Optionally configure the **Enable Overriding of Icon from Webhooks** option to allow external applciations to change the icon of the account posting messages. If not enabled, the icon of the creator of the webhook URL is used to post messages. 
 
2. Create a Mattermost Incoming Webhook URL
 1. Login to your Mattermost team site and go to **Account Settings -> Integrations**
 2. Next to **Incoming Webhooks** click **Edit**
 3. Select the channel or private group to receive webhook payloads, then click **Add** to create the webhook

3. Write a function to call the URL with a properly formatted JSON payload
 1. To make sure everything works, try a curl command from your terminal or command line to send a JSON string as the `payload` parameter in a HTTP POST request.
     - _Example:_
     ```
curl -i -X POST -d 'payload={"text": "Hello, this is some text."}' http://yourmattermost.com/hooks/xxx-generatedkey-xxx
```  
     2. In addition, with **Enable Overriding of Usernames from Webhooks** turned on,  you can also override the username the message posts as by providing a `username` parameter in your JSON payload. For example, you might want your message looking like it came from a robot so you can use ```payload={"username": "robot", "text": "Hello, this is some text."}``` to change the username of the post to robot. Note, to combat any malicious users from trying to use this to perform [phishing attacks](https://en.wikipedia.org/wiki/Phishing) a `BOT` indicator appears next to posts coming from incoming webhooks.
     3. With **Enable Overriding of Icon from Webhooks** turned on, you can similarly change the icon the message posts with by providing a link to an image in the `icon_url` parameter of your payload. For example, ```payload={"icon_url": "http://somewebsite.com/somecoolimage.jpg", "text": "Hello, this is some text."}``` will post using whatever image is located at `http://somewebsite.com/somecoolimage.jpg` as the icon for the post.

 2. Set up your integration running on your own machine or a hosting service like AWS or Heroku, to start sending real time updates to Mattermost channels and private groups.

Additional Notes:

1. For the JSON payload, if `Content-Type` is specified as `application/json` in the headers of the HTTP request then the body of the request can be direct JSON. ```{"text": "Hello, this is some text."}```  

2. You can override the channel specified in the webhook definition by specifying a `channel` parameter in your payload. For example, you might have a single webhook created for _Town Square_, but you can use ```payload={"channel": "off-topic", "text": "Hello, this is some text."}``` to send a message to the _Off-Topic_ channel using the same webhook URL.  

3. Also, as mentioned previously, [markdown](../../usage/Markdown.md) can be used to create richly formatted payloads, for example: ```payload={"text": "# A Header\nThe _text_ below **the** header."}``` creates a messages with a header, a carriage return and bold text for "the".  

4. Just like regular posts, the text will be limited to 4000 characters at maximum.

### Slack Compatibility 

As mentioned above, Mattermost makes it easy to take integrations written for Slack's proprietary JSON payload format and repurpose them to become Mattermost integrations. The following automatic translations are supported: 

1. Payloads designed for Slack using `<>` to note the need to hyperlink a URL, such as ```payload={"text": "<http://www.mattermost.com/>"}```, are translated to the equivalent markdown in Mattermost and rendered the same as you would see in Slack. 
2. Similiarly, payloads designed for Slack using `|` within a `<>` to define linked text, such as ```payload={"text": "Click <http://www.mattermost.com/|here> for a link."}```, are also translated to the equivalent markdown in Mattermost and rendered the same as you would see in Slack. 
3. Like Slack, by overriding the channel name with an @username, such as payload={"text": "Hi", channel: "@jim"}, you can send the message to a user through your direct message chat.
4. Channel names can be prepended with a #, like they are in Slack incoming webhooks, and the message will still be sent to the correct channel.

To learn more about Incoming Webhooks and to see samples and community contributions, please visit <http://mattermost.org/webhooks>
