# Account Settings
___
Account Settings is accessible from the **Main Menu** by clicking the three dots at the top of the channels pane. From here, you can configure your profile settings, notification preferences, integrations, theme settings, and display options.

## General
Settings to configure name, username, nickname, email and profile picture.

#### Full Name
Full names appear in the Direct Messages member list and team management modal. By default, you will receive mention notifications when someone types your first name. Entering a full name is optional.

#### Username
Usernames appear next to all posts. Pick something easy for teammates to recognize and recall. By default, you will receive mention notifications when someone types your username.

####Nickname
Nicknames appear in the Direct Messages member list and team management modal. You will not receive mention notifications when someone types your nickname unless you add it to the *Words That Trigger Mentions* in **Account Settings > Notifications**.

#### Email
Email is used for sign-in, notifications, and password reset. Email requires verification if changed. If you are signing in using a single sign-on service, the email field is not editable and you will receive email notifications to the email you used to sign up to your SSO service.

#### Profile Picture
Profile pictures appear next to all posts and in the top of the channels pane next to your name. All users have a generic profile picture when they sign up for an account. Edit your profile picture by clicking **Select** and then choosing a picture in either JPG or PNG format that’s at least 128px wide and 128px high. For best results, choose an image that is square with the subject of interest centered. If you edit your profile picture, all past posts will appear with the new picture.

##Security
Settings to configure your password, view access history, and view or logout of active sessions.

#### Password
You may change your password if you’ve logged in by email. If you are signing in using a single sign-on service, the password field is not editable, and you must access your SSO service’s account settings to update your password.

#### View Access History
Access History displays a chronological list of the last 20 login and logout attempts, channel creations and deletions, account settings changes, or channel setting modifications made on your account. Click **More Info** to view the IP address and session ID of each action.

#### View and Logout of Active Sessions
Sessions are created when you log in with your email and password to a new browser on a device. Sessions let you use Mattermost for up to 30 days without having to log in again. Click **Logout** on an active session if you want to revoke automatic login privileges for a specific browser or device. Click **More Info** to view details on browser and operating system.

## Notifications
Settings to configure desktop notifications, desktop notification sounds, email notifications, and words that trigger mentions.

#### Send Desktop Notifications
Desktop notifications appear at the bottom right corner of your main monitor. The desktop notification preference you choose in *Account Settings* applies globally, but this preference is customizable for each channel from the channel name drop-down menu. Desktop notifications are available on Firefox, Safari, and Chrome.

#### Desktop Notification Sounds
A notification sound plays for all Mattermost posts that would fire a desktop notification, unless *Desktop Notification Sound* is turned off. Desktop notification sounds are available on Firefox, Safari, Chrome, Internet Explorer, and Edge.

#### Email Notifications
Email notifications are sent for mentions and direct messages after you’ve been offline for more than 60 seconds or away from Mattermost for more than 5 minutes. Change the email where notifications are sent from **Account Settings > General > Email**.

#### Words That Trigger Mentions
By default, you will receive mention notifications from your non-case sensitive username, mentioned @username, @all, and @channel. Customize the words that trigger mentions by typing them in the input box. This is useful if you want to be notified of all posts on a certain topic, for example, “marketing”.

## Appearance
Settings to customize your account’s theme colors and code theme.

#### Theme Colours
Select **Theme Colors** to select from four standard themes designed by the Mattermost team. To make custom adjustments on the four standard theme colours, click a standard theme and then select **Custom Theme** to load the standard theme into the custom theme color selectors.

#### Custom Theme
Customize your theme colors and share them with others by copying and pasting theme vectors into the input box. Observe a live preview as you customize theme colors and then click **Save** to confirm your changes. Discard your changes by exiting the settings modal and clicking **Yes, Discard**.

- **Sidebar BG:** Background color of the Channels pane, and Account and Team settings navigation sidebars.
- **Sidebar Text:** Text colour of read channels in the Channels pane, and tabs in the Account and Team settings navigation sidebar.
- **Sidebar Header BG:** Background color of the header above the Channels pane and all modal headers.
- **Sidebar Header Text:** Text colour of the header above the Channels pane and all modal headers.
- **Sidebar Unread Text:** Text color of unread channels in the Channels pane.
- **Sidebar Text Hover BG:** Background color behind channel names and settings tabs as you hover over them.
- **Sidebar Text Active Border:** Color of the rectangular marker on the left side of the Channels pane or Settings sidebar indicating the active channel or tab.
- **Sidebar Text Active Color:** Text color of the active active channel or tab in the Channels pane or Settings sidebar.
- **Online Indicator:** Color of the online indicator appearing next to team members names in the Direct Messages list.
- **Mention Jewel BG:** Background color of the jewel indicating unread mentions that appears to the right of the channel name. This is also the background color of the “Unread Posts Below/Above” indicator appearing at the top or bottom of the Channels pane on shorter browser windows.
- **Mention Jewel Text:** Text color on the mention jewel indicating the number of unread mentions. This is also the text color on the “Unread Posts Below/Above” indicator.
- **Center Channel BG:** Color of the center pane, RHS and all modal backgrounds.
- **Center Channel Text:** Color of all the text - with the exception of mentions, links, hashtags and code blocks - in the center pane, RHS and modals. 
- **New Message Separator:** The new massage separator appears below the last read message when you click into a channel with unread messages.
- **Link Color:** Text color of all links, hashtags, teammate mentions, and low priority UI buttons.
- **Button BG:** Color of the rectangular background behind all high priority UI buttons.
- **Button Text:** Text colour appearing on the rectangular background for all high priority UI buttons.
- **Mention Highlight BG:** Highlight color behind your words that trigger mentions in the center pane and RHS.
- **Mention Highlight Link:** Text color of your words that trigger mentions in the center pane and RHS.
- **Code Theme:** Background and syntax colors for all code blocks.

#### Import theme colors from Slack
To import a theme, go to **Preferences > Sidebar Theme** from within Slack, open the custom theme option, copy the theme color vector and then paste it into the *Input Slack Theme* input box in Mattermost. Any theme settings that are not customizable in Slack will default to the “Mattermost” standard theme settings.

## Integrations
Settings to configure incoming and outgoing webhooks for your team.

#### Incoming Webhooks
Incoming webhooks from external integrations can post messages to Mattermost in public channels or private groups. Learn more about setting up incoming webhooks on our [documentation page](https://github.com/mattermost/platform/blob/master/doc/integrations/webhooks/Incoming-Webhooks.md).


#### Outgoing Webhooks
Outgoing webhooks use trigger words to fire new message events to external integrations. For security reasons, outgoing webhooks are only available in public channels. Learn more about setting up outgoing webhooks on our [documentation page](https://github.com/mattermost/platform/blob/master/doc/integrations/webhooks/Outgoing-Webhooks.md).

##Display
Settings to configure clock and teammate name display preferences.

#### Display Font
Select what font is used.

#### Clock Display
Choose a 12-hour or 24-hour time preference that appears on the time stamp for all posts. 

#### Teammate Name Display
Configure how names are displayed in the Direct Messages list in the Channels pane: nickname, username or full name.

## Advanced
Setting to configure when messages are sent.

#### Send Messages on Ctrl+Enter
If enabled, press **Enter** to insert a new line and **Ctrl + Enter** posts the message. If disabled, **Shift + Enter** inserts a new line and **Enter** posts the message.

#### Preview pre-release features
Turn on preview features to view them early, ahead of their official release:
- **Show markdown preview option in message input box:** Turning this on will show a "Preview" option when typing in the text input box. Pressing "Preview" shows what the Markdown formatting in the message looks like before the message is sent.
- **Show preview snippet of links below message:** Turning this on will show a preview snippet posted below links from select websites. 

