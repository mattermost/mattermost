# Mattermost Changelog

## Release v2.0.0

Expected Release date: 2016-02-16

### Highlights 

#### Incremented Version Number: Mattermost "2.0" 

- Version number incremented from "1.x" to "2.x" indicating major product changes, including: 
    
##### Localization 

- Addition of localization support to entire user interface plus error and log messages
- Added Spanish language translation (Beta quality) available from **Account Settings** > **Display**

##### Enhanced Support for Mobile Devices 

- BREAKING CHANGE to APIs: New Android and updated iOS apps require `platform` 2.0 and higher
- iOS added app support for GitLab single-sign-on
- iOS added app support for LDAP/AD single-sign-on (Enterprise Edition only) 

##### Upgrade and Deployment Improvements
- Mattermost v2.0 now upgrades from up to two previous major builds (e.g. v1.4.x and v1.3.x)
- Added option to allow use of insecure TLS outbound connections to allow use of self-signed certificates

### New Features

Localization 

- Addition of localization support to entire user interface plus error and log messages
- Added Spanish language translation (Beta quality) available from **Account Settings** > **Display**

Slash Commands

- Added [Slack-compatible slash commands](http://docs.mattermost.com/developer/slash-commands.html) to integrate with external systems 

iOS

- [iOS app](https://github.com/mattermost/ios) added support for GitLab single-sign-on
- [iOS app](https://github.com/mattermost/ios) added support for LDAP/AD single-sign-on (Enterprise Edition only) 

Android 

- New open source Android application compatible with Mattermost 2.0 and higher 

System Console

- Added **Site Reports** to view system statistics on posts, channels and users. 

### Improvements 

Upgrading

- Mattermost v2.0 now upgrades from up to two previous major builds (e.g. v1.4.x and v1.3.x).

Files and Images

- Public links to images and files created by users no longer expire 
- OGG attachments now play in preview window on Chrome and Firefox

Onboarding

- “Get Team Invite Link” option is disabled from the main menu if user creation is disabled for the team
- Tutorial colors improved to provide higher contrast with new default theme

Authentication

- Added ability to sign in with username as an alternative to email address
- Switching from email to SSO for sign in now updates email address to use the SSO email

System Console

- Added option to allow use of insecure TLS outbound connections to allow use of self-signed certificates
- Removed unused "Disable File Storage" option from **System Console** > **File Storage**
- Added warning if a user demotes their account from System Administrator

Search

- Hashtag search is no longer case sensitive
- System messages no longer appear in search results
- Date separator added to search results 
- Moved the recent mentions icon to the right of the search bar

Messaging 
- Changed the comment bubble to a reply arrow to make post replies and the RHS more discoverable
- Time stamp next to sequential posts made by users now shows HH:MM instead of on-hover timestamp
- Code blocks now support horizontal scrolling if content exceeds the max width 

User Interface

- Away status added to note users who have been idle for more than 5 minutes.
- Long usernames are now truncated in the center channel and RHS
- Added more favicon sizes for home screen icons on mobile devices

#### Bug Fixes  

- Incorrect “Mattermost unreachable” error on iOS no longer appears
- Dialog to confirm deletion of a post now supports hitting “ENTER” to confirm deletion. 
- Keyboard focus on the New Channel modal on IE11 is now contained within the text box.
- LHS indicator for “Unread Posts Above/Below” now displays on IE11
- Unresponsive UI when viewing a permalink is fixed if a user clicks outside the text on the "Click here to jump to recent messages" bar. 
- Dismissed blue bar error messages no longer re-appear on page refresh.
- Console error is no longer thrown on first page load in Firefox and Edge.
- Console error and missing notification is fixed for the first direct message received from any user.
- Comment bubble in Firefox no longer appears with a box around it on-hover.
- Home screen icons on Android and iOS devices now appear with the Mattermost logo.
- Switching channels now clears the “user is typing” message below the text input box.
- iOS devices are no longer detected as “unknown” devices in the session history.

### Compatibility  
Changes from v1.4 to v2.0:

**iOS**  
Mattermost iOS app v2.0 requires Mattermost platform v2.0 and higher.

**config.json**    
Multiple setting options were added to `config.json`. Below is a list of the additions and their default values on install. The settings can be modified in `config.json` or the System Console.  

- Under `ServiceSettings` in `config.json`:
    - `"EnableCommands": false` to set whether users can create slash commands from **Account Settings** > **Integrations** > **Commands**
    - `"EnableOnlyAdminIntegrations": true` to restrict integrations to being created by admins only.
    - `"EnableInsecureOutgoingConnections": false` sets whether outgoing HTTPS requests can accept unverified, self-signed certificates.
    - Optional: `"WebsocketSecurePort" : 443` sets the port on which the secured WebSocket will listen using the `wss` protocol. If this setting is not present in `config.json`, it defaults to `443`.
    - Optional: `"WebsocketPort": 80` sets the port on which the unsecured WebSocket will listen using the `ws` protocol. If this setting is not present in `config.json`, it defaults to `80`.

- Under `EmailSettings` in `config.json`:
    -  `"EnableSignInWithEmail": true` allows users to sign in using their email.    
    -  `"EnableSignInWithUsername": false` sets whether users can sign in with their username. Typically only used when email verification is disabled.

**Localization**  
There are two new directories for i18n localization JSON files:
- platform/i18n for server-side localization files
- platform/web/static/i18n for client-side localization files

#### Database Changes from v1.4 to v2.0

The following is for informational purposes only, no action needed. Mattermost automatically upgrades database tables from the previous version's schema using only additions.

##### Users Table
1. Added `Locale` column

##### Licenses Table
1. Added `Licenses` Table

#### Known Issues

- Navigating to a page with new messages containing inline images added via markdown causes the channel to scroll up and down while loading the inline images.
- Microsoft Edge does not yet support drag and drop for file attachments. 
- Scroll bar does not appear in the center channel.
- Unable to paste images into the text box on Firefox, Safari, and IE11.
- Importing from Slack fails to load messages in certain cases and breaks @mentions.
- System Console > TEAMS > Statistics > Newly Created Users shows all users as created "just now".
- Favicon does not turn red when @mentions and direct messages are received in an inactive browser tab.
- Searching for a phrase in quotations returns more than just the phrase on installations with a Postgres database.
- Archived channels are not removed from the "More" menu for the person that archived the channel until after refresh.
- Search results don't highlight searches for @username, non-latin characters, or terms inside Markdown code blocks.
- Searching for a username or hashtag containing a dot returns a search where the dot is replaced with the "or" operator. 
- Hashtags less than three characters long are not searchable.
- Users remains in the channel counter after being deactivated.
- Messages with symbols (<,>,-,+,=,%,^,#,*,|) directly before or after a hashtag are not searchable.
- Permalinks for the second message or later consecutively sent in a group by the same author displaces the copy link popover or causes an error
- Emoji smileys ending with a letter at the end of a message do not auto-complete as expected

#### Contributors 

Special thanks to [enahum](https://github.com/enahum) for creating the Spanish localization!

Many thanks to all our external contributors. In no particular order:

- [enahum](https://github.com/enahum)
- [trashcan](https://github.com/trashcan)
- [khoa-le](https://github.com/khoa-le)
- [alanmoo](https://github.com/alanmoo)
- [fallenby](https://github.com/fallenby)
- [loafoe](https://github.com/loafoe)
- [gramakri](https://github.com/gramakri)
- [pawelad](https://github.com/pawelad)
- [cifvts](https://github.com/cifvts)
- [rosskusler](https://github.com/rosskusler)
- [apskim](https://github.com/apskim) 

## Release v1.4.0

Expected Release date: 2016-01-16

### Release Highlights

#### Data Center Support 

- Deployment guides on Red Hat Enterprise Linux 6 and 7 now available 
- Legal disclosure and support links (terms of service, privacy policy, help, about, and support email) now configurable
- Over a dozen new configuration options in System Console

#### Mobile Experience

- iOS reference app [now available from iTunes](https://itunes.apple.com/us/app/mattermost/id984966508?ls=1&mt=8), compiled from [open source repo](https://github.com/mattermost/ios)
- Date headers now show when scrolling on mobile, so you can quickly see when messages were sent
- Added "rapid scroll" support for jumping quickily to bottom of channels on mobile 

### New Features

Mobile Experience
- Date headers now show when scrolling on mobile, so you can quickly see when messages were sent
- Added "rapid scroll" support for jumping quickily to bottom of channels on mobile 

Authentication

- Accounts can now switch between email and GitLab SSO sign-in options 
- New ability to customize session token length 

System Console

- Added **Legal and Support Settings** so System Administrators can change the default Terms of Service, Privacy Policy, and Help links
- Under **Service Settings** added options to customize expiry of web, mobile and SSO session tokens, expiry of caches in memory, and an EnableDeveloper option to turn on Developer Mode which alerts users to any console errors that occur

### Improvements 

Performance and Testing

- Added logging for email and push notifications events in DEBUG mode 

Integrations

- Added support to allow optional parameters in the `Content-Type` of incoming webhook requests

Files and Images

- Animated GIFs autoplay in the image previewer

Notifications and Email

- Changed email notifications to display the server's local timezone instead of UTC

User Interface

- Updated the "About Mattermost" dialog formatting
- Going to domain/teamname now goes to the last channel of your previous session, instead of Town Square
- Various improvements to mobile UI, including a floating date indicator and the ability to quickly scroll to the bottom of the channel

#### Bug Fixes  

- Fixed issue where usernames containing a "." did not get mention notifications
- Fixed issue where System Console did not save the "Send push notifications" setting
- Fixed issue with Font Display cancel button not working in Account Settings menu
- Fixed incorrect default for "Team Name Display" settings
- Fixed issue where various media files appeared broken in the media player on some browsers 
- Fixed cross-contamination issue when multiple accounts log into the same team on the same browser
- Fixed issue where color pickers did not update when a theme was pasted in
- Increased the maximum number of channels

### Compatibility  

#### Config.json Changes from v1.3 to v1.4

Multiple settings were added to `config.json`. Below is a list of the changes and their new default values in a fresh install. 

The following options can be modified in the System Console:  

- Under `ServiceSettings` in `config.json`:
  - Added: `"EnableDeveloper": false` to set whether developer mode is enabled, which alerts users to any console errors that occur
  - Added: `"SessionLengthWebInDays" : 30` to set the number of days before web sessions expire and users will need to log in again
  - Added: `"SessionLengthMobileInDays" : 30` to set the number of days before native mobile sessions expire
  - Added: `"SessionLengthSSOInDays" : 30` to set the number of days before  SSO sessions expire
  - Added: `"SessionCacheInMinutes" : 10` to set the number of minutes to cache a session in memory
- Added `SupportSettings` section to `config.json`:
  - Added: `"TermsOfServiceLink": "/static/help/terms.html"` to allow System Administrators to set the terms of service link
  - Added: `"PrivacyPolicyLink": "/static/help/privacy.html"` to allow System Administrators to set the privacy policy link
  - Added: `"AboutLink": "/static/help/about.html"` to allow System Administrators to set the about page link
  - Added: `"HelpLink": "/static/help/help.html"` to allow System Administrators to set the help page link
  - Added: `"ReportAProblemLink": "/static/help/report_problem.html"` to allow System Administrators to set the home page for the support website
  - Added: `"SupportEmail":"feedback@mattermost.com"` to allow System Administrators to set an email address for feedback and support requests

The following options are not present in the System Console, and can be modified manually in the `config.json` file:  

- Under `FileSettings` in `config.json`:
  - Added: `"AmazonS3Endpoint": ""` to set an endpoint URL for an Amazon S3 instance
  - Added: `"AmazonS3BucketEndpoint": ""` to set an endpoint URL for Amazon S3 buckets
  - Added: `"AmazonS3LocationConstraint": false` to set whether the S3 region is location constrained
  - Added: `"AmazonS3LowercaseBucket": false` to set whether bucket names are fully lowercase or not

#### Known Issues

- When navigating to a page with new messages as well as message containing inline images added via markdown, the channel may move up and down while loading the inline images
- Microsoft Edge does not yet support drag and drop 
- No scroll bar in center channel
- Pasting images into text box fails to upload on Firefox, Safari, and IE11
- Public links for attachments attempt to download the file on IE, Edge, and Safari
- Importing from Slack breaks @mentions and fails to load in certain cases with comments on files 
- System Console > TEAMS > Statistics > Newly Created Users shows all of the users are created "just now"
- Favicon does not always become red when @mentions and direct messages are received on an inactive browser tab
- Searching for a phrase in quotations returns more than just the phrase on Mattermost installations with a Postgres database
- Deleted/Archived channels are not removed from the "More" menu of the person that deleted/archived the channel until after refresh
- Search results don't highlight searches for @username, non-latin characters, or terms inside Markdown code blocks
- Searching for a username or hashtag containing a dot returns a search where the dot is replaced with the "or" operator 
- Hashtags less than three characters long are not searchable
- After deactivating a team member, the person remains in the channel counter
- Certain symbols (<,>,-,+,=,%,^,#,*,|) directly before or after a hashtag cause the message to not show up in a hashtag search
- Security tab > Active Sessions reports iOS devices as "unknown"
- Getting a permalink for the second message or later consecutively sent in a group by the same author displaces the copy link popover or causes an error

#### Contributors 

Many thanks to our external contributors. In no particular order:

- [npcode](https://github.com/npcode)
- [hjf288](https://github.com/hjf288)
- [apskim](https://github.com/apskim)
- [ejm2172](https://github.com/ejm2172)
- [hvnsweeting](https://github.com/hvnsweeting)
- [benburkert](https://github.com/benburkert)
- [erikthered](https://github.com/erikthered)

## Release v1.3.0

Release date: 2015-12-16

### Release Highlights

#### iOS App

- New [Mattermost iOS App](https://github.com/mattermost/ios) now available for iPhone, iPad, and iPod Touch
- New [Mattermost Push Notification Service](https://github.com/mattermost/push-proxy) to relay notifications to custom iOS applications

#### Search Upgrades

- Jump to search results in archives using new message permalinks 
- It's easier to find what you're looking for with improved auto-complete in search

#### Advanced Formatting

- Express more in symbols, with new emoji auto-complete
- Express more in numbers, with rendering of mathematical expressions using Latex (start code blocks with ```latex)
- Personalize your look with new custom font settings under **Account Settings** > **Display** > **Display Font**

### New Features

Authentication
- Added unofficial SSO support for GitHub.com and GitHub Enterprise using GitLab UI

Archives
- Added permalink feature that lets users link to a post in the message archives
- Added ability to "Jump" to archives from a search result

Account Settings
- Added "Preview pre-release features" setting, to allow user to preview early features ahead of their official release
- Added "Display font" setting, so users can select which font to use

Messaging & Comments
- Added in-line previews for links from select websites and for URLs pointing to an image (enabled via Account Settings -> Advanced -> Preview pre-release features)
- Added emoji autocomplete

Extras
- Added `/loadtest url` tool for manually [testing text processing](https://github.com/mattermost/platform/tree/master/doc/developer/tests)

### Improvements 

Performance
- Updated getProfiles service to return less data
- Refactored several modals to use React-Boostrap
- Refactored the center channel

Messaging & Comments
- Added Markdown support for task lists
- Added "Help" link for messaging
- Added ability to preview a Markdown message before sending (enabled via Account Settings -> Advanced -> Preview pre-release features)

Onboarding
- Minor upgrades to tutorial 

User Interface
- Visually combined sequential messages from the same user 
- Added ability to rename "Town Square"
- Teammate name display option now applies to messages and comments
- Menus and search improved on mobile UI
- Switched to Emoji One style emojis

#### Bug Fixes  

- Removed the @all mention to keep users from accidentally spamming team sites
- Fixed bug where the member list only showed "20" members for channels with more than 20 members
- Fixed bug where the channel sidebar didn't order correctly on Postgres databases
- Fixed bug where search results did not highlight when searching with quotation marks, wildcard, or in: and from: modifiers
- Fixed bug with the cancel button not properly resetting the text in some account settings fields
- Fixed bug where editing a post to be empty caused a 404 error
- Fixed bug where logging out did not work properly on IE11
- Fixed issue where refreshing the page with the right hand sidebar open caused "..." to show up in place of usernames
- Fixed issue where invite to channel modal did not update properly when switching between channels

### Compatibility  

#### Config.json Changes from v1.2 to v1.3

Multiple settings were added to [`config.json`](./config/config.json). These options can be modified in the System Console, or manually updated in the existing config.json file. This is a list of changes and their new default values in a fresh install: 
- Under `EmailSettings` in `config.json`:
  - Removed: `"ApplePushServer": ""` which is replaced with `SendPushNotifications` and `PushNotificationServer`
  - Removed: `"ApplePushCertPublic": ""`  which is replaced with `SendPushNotifications` and `PushNotificationServer`
  - Removed: `"ApplePushCertPrivate": ""` which is replaced with `SendPushNotifications` and `PushNotificationServer`
  - Added: `"SendPushNotifications": false` to control whether mobile push notifications are sent to the server specified in `PushNotificationServer`
  - Added: `"PushNotificationServer": ""` to specify the address of the proxy server that re-sends push notifications to their respective services like APNS (Apple Push Notification Services)

#### Known Issues

- System Console does not save Email Settings when "Save" is clicked
- When navigating to a page with new messages as well as message containing inline images added via markdown, the channel may move up and down while loading the inline images
- Microsoft Edge does not yet support drag and drop 
- Media files of type .avi .mkv .wmv .mov .flv .mp4a do not play  properly
- No scroll bar in center channel
- Pasting images into text box fails to upload on Firefox, Safari, and IE11
- Slack import @mentions break
- Usernames containing a "." do not get mention notifications

#### Contributors 

Many thanks to our external contributors. In no particular order:

- [florianorben](https://github.com/florianorben)
- [npcode](https://github.com/npcode)
- [42wim](https://github.com/42wim)
- [cifvts](https://github.com/cifvts)
- [rompic](https://github.com/rompic)
- [jdhoek](https://github.com/jdhoek)
- [Tsynapse](https://github.com/Tsynapse)
- [alexgaribay](https://github.com/alexgaribay)
- [vladikoff](https://github.com/vladikoff)
- [jonathanwiesel](https://github.com/jonathanwiesel)
- [tamtamchik](https://github.com/tamtamchik)

## Release v1.2.1

- **Released:** 2015-11-16

### Security Notice

Mattermost v1.2.1 is a bug fix release addressing a security issue in v1.2.0 affecting a newly introduced outgoing webhooks feature. Specifically, in v1.2.0 there was a check missing from outgoing webhooks, so a team member creating outgoing webhooks could in theory find a way to listen to messages in private channels containing popular words like "a", "the", "at", etc. For added security, Mattermost v1.2.1 now installs with incoming and outgoing webhooks disabled by default. 

To limit the impact of this security issue, Mattermost v1.2.0 has been removed from the source repo. It is recommended that anyone who's installed v1.2.0 upgrade to v1.2.1 via [the procedure described in the Mattermost Upgrade Guide](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md). 

### Release Highlights

#### Outgoing webhooks

- Mattermost users can now interact with external applications using [outgoing webhooks](https://github.com/mattermost/platform/blob/master/doc/integrations/webhooks/Outgoing-Webhooks.md)
- An [application template](https://github.com/mattermost/mattermost-integration-giphy) demonstrating user queries sent to the Giphy search engine via Mattermost webhooks now available
- A community application, [Matterbridge](https://github.com/42wim/matterbridge?files=1), shows how to use webhooks to connect Mattermost with IRC 

#### Search Scope Modifiers 

- Adding search term `in:[channel_url_name]` now limits searches within a specific channel
- Adding search term `from:[username]` now limits searches to messages from a specific user

#### Syntax Highlighting 

- Syntax highlight for code blocks now available for `Diff, Apache, Makefile, HTTP, JSON, Markdown, JavaScript, CSS, nginx, ObjectiveC, Python, XML, Perl, Bash, PHP, CoffeeScript, C, SQL, Go, Ruby, Java, and ini`

#### Usability Improvements 

- Added tutorial to teach new users how to use Mattermost 
- Various performance improvements to support teams with hundreds of users 
- Direct Messages "More" menu now lets you search for users by username and real name

### Improvements 

Onboarding 

- New tutorial explaining how to use Mattermost for new users

Messaging and Notifications 

- Users can now search for teammates to add to **Direct Message** list via **More** menu
- Users can now personalize Direct Messages list by removing users listed
- Link previews - Adding URL with .gif file adds image below message
- Added new browser tab alerts to indicate unread messages and mentions 

Search 

- Adding search term `in:[channel_url_name]` now limits searches within a specific channel
- Adding search term `from:[username]` now limits searches to messages from a specific user
- Tip explaining search options when clicking into search box

Integrations 

- [Outgoing webhooks](https://github.com/mattermost/platform/blob/master/doc/integrations/webhooks/Outgoing-Webhooks.md) now available
- Made available [application template showing outgoing webhooks working with Mattermost and external application](https://github.com/mattermost/mattermost-integration-giphy)

User Interface

- Member list in Channel display now scrollable, and includes Message button to message channel members directly
- Added ability to edit previous message by hitting UP arrow 
- Syntax highlighting added for code blocks 
   - Languages include `Diff, Apache, Makefile, HTTP, JSON, Markdown, Java, CSS, nginx, ObjectiveC, Python, XML, Perl, Bash, PHP, CoffeeScript, C, SQL, Go, Ruby, Java, and ini`. 
   - Use by adding the name of the language on the first link of the code block, for example: ```python
   - Syntax color theme can be defined under **Account Settings** > **Appearance Settings** > **Custom Theme**
- Updated Drag & Drop UI
- Added 24 hour time display option 

Team Settings

- Added Team Settings option to include account creation URL on team login page
- Added Team Settings option to include link to given team on root page
- Ability to rotate invite code for invite URL 

Extras

- Added `/shrug KEYWORD` command to output: `¯\_(ツ)_/¯ KEYWORD`
- Added `/me KEYWORD` command to output: _`KEYWORD`_ 
- Added setting option to send a message on control-enter instead of enter

System Console

- New statistics page
- Configurable option to create an account directly from team page

#### Bug Fixes  

- Various fixes to theme colors
- Fixed issue with the centre channel scroll position jumping when right hand side was opened and closed
- Added support for simultaneous login to different teams in different browser tabs
- Incoming webhooks no longer disrupted when channel is deleted
- You can now paste a Mattermost incoming webhook URL into the same field designed for a Slack URL and integrations will work 

### Compatibility  

- IE 11 new minimum version for IE, since IE 10 share fell below 5% on desktop 
- Safari 9 new minimum version for Safari, since Safari 7 and 8 fell below 1% each on desktop 

#### Config.json Changes from v1.1 to v1.2

Multiple settings were added to [`config.json`](./config/config.json). These options can be modified in the System Console, or manually updated in the existing config.json file. This is a list of changes and their new default values in a fresh install: 
- Under `TeamSettings` in `config.json`:
  - Added: `"RestrictTeamNames": true` to control whether team names can contain reserved words like www, admin, support, test, etc.
  - Added: `"EnableTeamListing": false` to control whether teams can be listed on the root page of the site
- Under `ServiceSettings` in `config.json`
  - Added: `"EnableOutgoingWebhooks": false` to control whether outgoing webhooks are enabled
  - Changed: `"EnableIncomingWebhooks": true` to `"EnableIncomingWebhooks": false` to turn incoming webhooks off by default, to increase security of default install. Documentation updated to enable webhooks before use. 

#### Database Changes from v1.1 to v1.2

The following is for informational purposes only, no action needed. Mattermost automatically upgrades database tables from the previous version's schema using only additions. Sessions table is dropped and rebuilt, no team data is affected by this. 

##### Channels Table
1. Renamed `Description` to `Header`
2. Added `Purpose` column with type `varchar(1024)`

##### Preferences Table
1. Added `Preferences` Table

##### Teams Table 
1. Added `InviteId` column with type `varchar(32)`
2. Added `AllowOpenInvite` column with type `tinyint(1)`
3. Added `AllowTeamListing` column with type `tinyint(1)`
4. Added `idx_teams_invite_id` index

#### Known Issues

- When navigating to a page with new messages as well as message containing inline images added via markdown, the channel may move up and down while loading the inline images
- Microsoft Edge does not yet support drag and drop 
- After upgrading to v1.2 existing users will see the newly added tutorial tips upon login (this is a special case for v1.2 and will not happen in future upgrades)
- Channel list becomes reordered when there are lowercase channel names in a Postgres database
- Member list only shows "20" members for channels with more than 20 members
- Searches containing punctuation are not highlighted in the results (including in: or from: search modifiers and searches with quotations)
- Media files of type .avi .mkv .wmv .mov .flv .mp4a do not play  properly
- Editing a post so that it's text is blank (which should delete it) throws a 404
- No scroll bar in centre channel
- Theme color import from Slack fails to import the “Active Channel” selection color
- Pasting images into text box fails to upload on Firefox and Safari
- Users cannot claim accounts imported from Slack via password reset
- Slack import @mentions break

#### Contributors 

Many thanks to our external contributors. In no particular order:

- [florianorben](https://github.com/florianorben)
- [trashcan](https://github.com/trashcan)
- [girishso](https://github.com/girishso)
- [apaatsio](https://github.com/apaatsio)
- [jlebleu](https://github.com/jlebleu)
- [stasvovk](https://github.com/stasvovk)
- [mcmillhj](https://github.com/mcmillhj)
- [sharms](https://github.com/sharms)
- [jvasallo](https://github.com/jvasallo)
- [layzerar](https://github.com/layzerar)
- [optimistiks](https://github.com/optimistiks)
- [Tsynapse](https://github.com/Tsynapse)
- [vinnymac](https://github.com/vinnymac)
- [yuvipanda](https://github.com/yuvipanda)
- [toyorg](https://github.com/toyorg)

## Release v1.2.0 (Redacted Release)

- **Final release:** 2015-11-16 (**Note:** This release was removed from public availability and replaced by v1.2.1 owing to a security issue with the new outgoing webhooks feature. See v1.2.1 Release Notes for details).

## Release v1.1.1 (Bug Fix Release) 

Released 2015-10-20 

### About Bug Fix Releases

This is a bug fix release (v1.1.1) and recommended only for users needing a fix to the specific issue listed below. All other users should use the most recent major stable build release (v1.1.0). 

[View more information on Mattermost release numbering](https://github.com/mattermost/platform/blob/master/doc/install/release-numbering.md).

### Release Purpose

#### Provide option for upgrading database from Mattermost v0.7 to v1.1

Upgrading Mattermost v0.7 to Mattermost v1.1 originally required installing Mattermost v1.0 to upgrade from the Mattermost v0.7 database, followed by an install of Mattermost v1.1. 

This was problematic for installing Mattermost with GitLab omnibus since GitLab 8.0 contained Mattermost v0.7 and GitLab 8.1 was to include Mattermost v1.1

Therefore Mattermost v1.1.1 was created that can upgrade the database in Mattermost v0.7 to Mattermost v1.1 directly. 

Users who configured Mattermost v0.7 within GitLab via the `config.json` file should consult [documentation on upgrading configurations from Mattermost v0.7 to Mattermost v1.1](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md#upgrading-mattermost-v07-to-v11).

#### Removes 32-char limit on salts 

Mattermost v1.1 introduced a 32-char limit on salts that broke the salt generating in GitLab and this restriction was removed for 1.1.1. 

## Release v1.1.0

Released: 2015-10-16

### Release Highlights

#### Incoming Webhooks

Mattermost now supports incoming webhooks for channels and private groups. This developer feature is available from the Account Settings -> Integrations menu. Documentation on how developers can use the webhook functionality to build custom integrations, along with samples, is available at http://mattermost.org/webhooks. 

### Improvements

Integrations

- Improved support for incoming webhooks, including the ability to override a username and post as a bot instead

Documentation

- Added documentation on config.json and System Console settings 
- Docker Toolbox replaces deprecated Boot2Docker instructions in container install documentation 

Theme Colors

- Improved appearance of dark themes

System Console 

- Client side errors now written to server logs 
- Added "EnableSecurityFixAlert" option to receive alerts on relevant security fix alerts
- Various improvements to System Console UI and help text

Messaging and Notifications

- Replaced "Quiet Mode" in the Channel Notification Settings with an option to only show unread indicator when mentioned

### Bug Fixes

- Fixed regression causing "Get Public Link" on images not to work
- Fixed bug where certain characters caused search errors
- Fixed bug where System Administrator did not have Team Administrator permissions
- Fixed bug causing scrolling to jump when the right hand sidebar opened and closed

### Known Issues

- Slack import is unstable due to change in Slack export format
- Uploading a .flac file breaks the file previewer on iOS

### Compatibility 

#### Config.json Changes from v1.0 to v1.1 

##### Service Settings 

Multiple settings were added to [`config.json`](./config/config.json) and System Console UI. Prior to upgrading the Mattermost binaries from the previous versions, these options would need to be manually updated in existing config.json file. This is a list of changes and their new default values in a fresh install: 
- Under `ServiceSettings` in `config.json`:
  - Added: `"EnablePostIconOverride": false` to control whether webhooks can override profile pictures
  - Added: `"EnablePostUsernameOverride": false` to control whether webhooks can override profile pictures
  - Added: `"EnableSecurityFixAlert": true` to control whether the system is alerted to security updates

#### Database Changes from v1.0 to v1.1

The following is for informational purposes only, no action needed. Mattermost automatically upgrades database tables from the previous version's schema using only additions. Sessions table is dropped and rebuilt, no team data is affected by this. 

##### ChannelMembers Table
1. Removed `NotifyLevel` column
2. Added `NotifyProps` column with type `varchar(2000)` and default value `{}`

### Contributors

Many thanks to our external contributors. In no particular order: 

- [chengweiv5](https://github.com/chengweiv5)
- [pstonier](https://github.com/pstonier)
- [teviot](https://github.com/teviot)
- [tmuwandi](https://github.com/tmuwandi)
- [driou](https://github.com/driou)
- [justyns](https://github.com/justyns)
- [drbaker](https://github.com/drbaker)
- [thomas9987](https://github.com/thomas9987)
- [chuck5](https://github.com/chuck5)
- [sjmog](https://github.com/sjmog)
- [chengkun](https://github.com/chengkun)
- [sexybern](https://github.com/sexybern)
- [tomitm](https://github.com/tomitm)
- [stephenfin](https://github.com/stephenfin)

## Release v1.0.0

Released 2015-10-02

### Release Highlights

#### Markdown 

Markdown support is now available across messages, comments and channel descriptions for: 

- **Headings** - in five different sizes to help organize your thoughts 
- **Lists** - both numbered and bullets
- **Font formatting** - including **bold**, _italics_, ~~strikethrough~~, `code`, links, and block quotes)
- **In-line images** - useful for creating buttons and status messages
- **Tables** - for keeping things organized 
- **Emoticons** - translation of emoji codes to images like :sheep: :boom: :rage1: :+1: 

See [documentation](doc/help/enduser/markdown.md) for full details.

#### Themes

Themes as been significantly upgraded in this release with: 

- 4 pre-set themes, two light and two dark, to customize your experience
- 18 detailed color setting options to precisely match the colors of your other tools or preferences 
- Ability to import themes from Slack

#### System console and command line tools 

Added new web-based System Console for managing instance level configuration. This lets IT admins conveniently: 

- _access core settings_, like server, database, email, rate limiting, file store, SSO, and log settings, 
- _monitor operations_, by quickly accessing log files and user roles, and
- _manage teams_, with essential functions such as team role assignment and password reset

In addition new command line tools are available for managing Mattermost system roles, creating users, resetting passwords, getting version info and other basic tasks. 

Run `./platform -h` for documentation using the new command line tool.


### New Features 

Messaging, Comments and Notifications

- Full markdown support in messages, comments, and channel description 
- Support for emoji codes rendering to image files

Files and Images 

- Added ability to play video and audio files 

System Console 

- UI to change config.json settings
- Ability to view log files from console
- Ability to reset user passwords
- Ability for IT admin to manage members across multiple teams from single interface

User Interface

- Ability to set custom theme colors
- Replaced single color themes with pre-set themes
- Added ability to import themes from Slack

Integrations

- (Preview) Initial support for incoming webhooks 

### Improvements

Documentation

- Added production installation instructions 
- Updated software and hardware requirements documentation
- Re-organized install instructions out of README and into separate files
- Added Code Contribution Guidelines
- Added new hardware sizing recommendations 
- Consolidated licensing information into LICENSE.txt and NOTICE.txt
- Added markdown documentation 

Performance 

- Enabled Javascript optimizations 
- Numerous improvements in center channel and mobile web 

Code Quality 

- Reformatted Javascript per Mattermost Style Guide

User Interface

- Added version, build number, build date and build hash under Account Settings -> Security

Licensing 

- Compiled version of Mattermost v1.0.0 now available under MIT license

### Bug Fixes

- Fixed issue so that SSO option automatically set `EmailVerified=true` (it was false previously)

### Compatibility 

A large number of settings were changed in [`config.json`](./config/config.json) and a System Console UI was added. This is a very large change due to Mattermost releasing as v1.0 and it's unlikely a change of this size would happen again. 

Prior to upgrading the Mattermost binaries from the previous versions, the below options would need to be manually updated in your existing config.json file to migrate successfully. This is a list of changes and their new default values in a fresh install: 
#### Config.json Changes from v0.7 to v1.0 

##### Service Settings 

- Under `ServiceSettings` in [`config.json`](./config/config.json):
  - Moved: `"SiteName": "Mattermost"` which was added to `TeamSettings`
  - Removed: `"Mode" : "dev"` which deprecates a high level dev mode, now replaced by granular controls
  - Renamed: `"AllowTesting" : false` to `"EnableTesting": false` which allows the use of `/loadtest` slash commands during development
  - Removed: `"UseSSL": false` boolean replaced by `"ConnectionSecurity": ""` under `Security` with new options: _None_ (`""`), _TLS_ (`"TLS"`) and _StartTLS_ ('"StartTLS"`)
  - Renamed: `"Port": "8065"` to `"ListenAddress": ":8065"` to define address on which to listen. Must be prepended with a colon.
  - Removed: `"Version": "developer"` removed and version information now stored in `model/version.go`
  - Removed: `"Shards": {}` which was not used
  - Moved: `"InviteSalt": "gxHVDcKUyP2y1eiyW8S8na1UYQAfq6J6"` to `EmailSettings`
  - Moved: `"PublicLinkSalt": "TO3pTyXIZzwHiwyZgGql7lM7DG3zeId4"` to `FileSettings`
  - Renamed and Moved `"ResetSalt": "IPxFzSfnDFsNsRafZxz8NaYqFKhf9y2t"` to `"PasswordResetSalt": "vZ4DcKyVVRlKHHJpexcuXzojkE5PZ5eL"` and moved to `EmailSettings`
  - Removed: `"AnalyticsUrl": ""` which was not used
  - Removed: `"UseLocalStorage": true` which is replaced by `"DriverName": "local"` in `FileSettings`
  - Renamed and Moved: `"StorageDirectory": "./data/"` to `Directory` and moved to `FileSettings`
  - Renamed: `"AllowedLoginAttempts": 10` to `"MaximumLoginAttempts": 10`
  - Renamed, Reversed and Moved: `"DisableEmailSignUp": false` renamed `"EnableSignUpWithEmail": true`, reversed meaning of `true`, and moved to `EmailSettings`
  - Added: `"EnableOAuthServiceProvider": false` to enable OAuth2 service provider functionality
  - Added: `"EnableIncomingWebhooks": false` to enable incoming webhooks feature

##### Team Settings 

- Under `TeamSettings` in [`config.json`](./config/config.json):
  - Renamed: `"AllowPublicLink": true` renamed to `"EnablePublicLink": true` and moved to `FileSettings`
  - Removed: `AllowValetDefault` which was a guest account feature that is deprecated 
  - Removed: `"TermsLink": "/static/help/configure_links.html"` removed since option didn't need configuration
  - Removed: `"PrivacyLink": "/static/help/configure_links.html"` removed since option didn't need configuration
  - Removed: `"AboutLink": "/static/help/configure_links.html"` removed since option didn't need configuration
  - Removed: `"HelpLink": "/static/help/configure_links.html"` removed since option didn't need configuration
  - Removed: `"ReportProblemLink": "/static/help/configure_links.html"` removed since option didn't need configuration
  - Removed: `"TourLink": "/static/help/configure_links.html"` removed since option didn't need configuration
  - Removed: `"DefaultThemeColor": "#2389D7"` removed since theme colors changed from 1 to 18, default theme color option may be added back later after theme color design stablizes 
  - Renamed: `"DisableTeamCreation": false` to `"EnableUserCreation": true` and reversed
  - Added: ` "EnableUserCreation": true` added to disable ability to create new user accounts in the system

##### SSO Settings

- Under `SSOSettings` in [`config.json`](./config/config.json):
  - Renamed Category: `SSOSettings` to `GitLabSettings`
  - Renamed: `"Allow": false` to `"Enable": false` to enable GitLab SSO
  
##### AWS Settings

- Under `AWSSettings` in [`config.json`](./config/config.json):
  - This section was removed and settings moved to `FileSettings`
  - Renamed and Moved: `"S3AccessKeyId": ""` renamed `"AmazonS3AccessKeyId": "",` and moved to `FileSettings`
  - Renamed and Moved: `"S3SecretAccessKey": ""` renamed `"AmazonS3SecretAccessKey": "",` and moved to `FileSettings`
  - Renamed and Moved: `"S3Bucket": ""` renamed `"AmazonS3Bucket": "",` and moved to `FileSettings`
  - Renamed and Moved: `"S3Region": ""` renamed `"AmazonS3Region": "",` and moved to `FileSettings`

##### Image Settings 

- Under `ImageSettings` in [`config.json`](./config/config.json):
  - Renamed: `"ImageSettings"` section to `"FileSettings"`
  - Added: `"DriverName" : "local"` to specify the file storage method, `amazons3` can also be used to setup S3

##### EmailSettings

- Under `EmailSettings` in [`config.json`](./config/config.json):
  - Removed: `"ByPassEmail": "true"` which is replaced with `SendEmailNotifications` and `RequireEmailVerification`
  - Added: `"SendEmailNotifications" : "false"` to control whether email notifications are sent
  - Added: `"RequireEmailVerification" : "false"` to control if users need to verify their emails
  - Replaced: `"UseTLS": "false"` with `"ConnectionSecurity": ""` with options: _None_ (`""`), _TLS_ (`"TLS"`) and _StartTLS_ (`"StartTLS"`)
  - Replaced: `"UseStartTLS": "false"` with `"ConnectionSecurity": ""` with options: _None_ (`""`), _TLS_ (`"TLS"`) and _StartTLS_ (`"StartTLS"`)

##### Privacy Settings 

- Under `PrivacySettings` in [`config.json`](./config/config.json):
  - Removed: `"ShowPhoneNumber": "true"` which was not used
  - Removed: `"ShowSkypeId" : "true"` which was not used
  
### Database Changes from v0.7 to v1.0

The following is for informational purposes only, no action needed. Mattermost automatically upgrades database tables from the previous version's schema using only additions. Sessions table is dropped and rebuilt, no team data is affected by this. 

##### Users Table
1. Added `ThemeProps` column with type `varchar(2000)` and default value `{}`

##### Teams Table
1. Removed `AllowValet` column

##### Sessions Table
1. Renamed `Id` column `Token`
2. Renamed `AltId` column `Id`
3. Added `IsOAuth` column with type `tinyint(1)` and default value `0`

##### OAuthAccessData Table
1. Added new table `OAuthAccessData`
2. Added `AuthCode` column with type `varchar(128)`
3. Added `Token` column with type `varchar(26)` as the primary key
4. Added `RefreshToken` column with type `varchar(26)`
5. Added `RedirectUri` column with type `varchar(256)`
6. Added index on `AuthCode` column

##### OAuthApps Table
1. Added new table `OAuthApps`
2. Added `Id` column with type `varchar(26)` as primary key
2. Added `CreatorId` column with type `varchar(26)`
2. Added `CreateAt` column with type `bigint(20)`
2. Added `UpdateAt` column with type `bigint(20)`
2. Added `ClientSecret` column with type `varchar(128)`
2. Added `Name` column with type `varchar(64)`
2. Added `Description` column with type `varchar(512)`
2. Added `CallbackUrls` column with type `varchar(1024)`
2. Added `Homepage` column with type `varchar(256)`
3. Added index on `CreatorId` column

##### OAuthAuthData Table
1. Added new table `OAuthAuthData`
2. Added `ClientId` column with type `varchar(26)`
2. Added `UserId` column with type `varchar(26)`
2. Added `Code` column with type `varchar(128)` as primary key
2. Added `ExpiresIn` column with type `int(11)`
2. Added `CreateAt` column with type `bigint(20)`
2. Added `State` column with type `varchar(128)`
2. Added `Scope` column with type `varchar(128)`

##### IncomingWebhooks Table
1. Added new table `IncomingWebhooks`
2. Added `Id` column with type `varchar(26)` as primary key
2. Added `CreateAt` column with type `bigint(20)`
2. Added `UpdateAt` column with type `bigint(20)`
2. Added `DeleteAt` column with type `bigint(20)`
2. Added `UserId` column with type `varchar(26)`
2. Added `ChannelId` column with type `varchar(26)`
2. Added `TeamId` column with type `varchar(26)`
3. Added index on `UserId` column
3. Added index on `TeamId` column

##### Systems Table
1. Added new table `Systems`
2. Added `Name` column with type `varchar(64)` as primary key
3. Added `Value column with type `varchar(1024)`

### Contributors

Many thanks to our external contributors. In no particular order: 

- [jdeng](https://github.com/jdeng)
- [Trozz](https://github.com/Trozz)
- [LAndres](https://github.com/LAndreas)
- [JessBot](https://github.com/JessBot)
- [apaatsio](https://github.com/apaatsio)
- [chengweiv5](https://github.com/chengweiv5)

## Release v0.7.0 (Beta1) 

Released 2015-09-05

### Release Highlights

#### Improved GitLab Mattermost support 

Following the release of Mattermost v0.6.0 Alpha, GitLab 7.14 offered an automated install of Mattermost with GitLab Single-Sign-On (co-branded as "GitLab Mattermost") in its omnibus installer.

New features, improvements, and bug fixes recommended by the GitLab community were incorporated into Mattermost v0.7.0 Beta1--in particular, extending support of GitLab SSO to team creation, and restricting team creation to users with verified emails from a configurable list of domains.

#### Slack Import (Preview)

Preview of Slack import functionality supports the processing of an "Export" file from Slack containing account information and public channel archives from a Slack team.   

- In the feature preview, emails and usernames from Slack are used to create new Mattermost accounts, which users can activate by going to the Password Reset screen in Mattermost to set new credentials. 
- Once logged in, users will have access to previous Slack messages shared in public channels, now imported to Mattermost.  

Limitations: 

- Slack does not export files or images your team has stored in Slack's database. Mattermost will provide links to the location of your assets in Slack's web UI.
- Slack does not export any content from private groups or direct messages that your team has stored in Slack's database. 
- The Preview release of Slack Import does not offer pre-checks or roll-back and will not import Slack accounts with username or email address collisions with existing Mattermost accounts. Also, Slack channel names with underscores will not import. Also, mentions do not yet resolve as Mattermost usernames (still show Slack ID). These issues are being addressed in [Mattermost v0.8.0 Migration Support](https://mattermost.atlassian.net/browse/PLT-22?filter=10002).

### New Features 

GitLab Mattermost 

- Ability to create teams using GitLab SSO (previously GitLab SSO only supported account creation and sign-in)
- Ability to restrict team creation to GitLab SSO and/or users with email verified from a specific list of domains.

File and Image Sharing 

- New drag-and-drop file sharing to messages and comments 
- Ability to paste images from clipboard to messages and comments 

Messaging, Comments and Notifications 

- Send messages faster with from optimistic posting and retry on failure 

Documentation 

- New style guidelines for Go, React and Javascript 

### Improvements

Messaging, Comments and Notifications 

- Performance improvements to channel rendering
- Added "Unread posts" in left hand sidebar when notification indicator is off-screen

Documentation 

- Install documentation improved based on early adopter feedback

### Bug Fixes

- Fixed multiple issues with GitLab SSO, installation and on-boarding 
- Fixed multiple IE 10 issues 
- Fixed broken link in verify email function 
- Fixed public links not working on mobile

### Contributors

Many thanks to our external contributors. In no particular order: 

- [asubset](https://github.com/asubset)
- [felixbuenemann](https://github.com/felixbuenemann)
- [CtrlZvi](https://github.com/CtrlZvi)
- [BastienDurel](https://github.com/BastienDurel)
- [manusajith](https://github.com/manusajith)
- [doosp](https://github.com/doosp)
- [zackify](https://github.com/zackify)
- [willstacey](https://github.com/willstacey)

Special thanks to the GitLab Mattermost early adopter community who influenced this release, and who play a pivotal role in bringing Mattermost to over 100,000 organizations using GitLab today. In no particular order: 

- [cifvts](http://forum.mattermost.org/users/cifvts/activity)
- [Chryb](https://gitlab.com/u/Chryb)
- [cookacounty](https://gitlab.com/u/cookacounty)
- [bweston92](https://gitlab.com/u/bweston92)
- [mablae](https://gitlab.com/u/mablae)
- [picharmer](https://gitlab.com/u/picharmer)
- [cmtonkinson](https://gitlab.com/u/cmtonkinson)
- [cmthomps](https://gitlab.com/u/cmthomps)
- [m.gamperl](https://gitlab.com/u/m.gamperl)
- [StanMarsh](https://gitlab.com/u/StanMarsh)
- [alx1](https://gitlab.com/u/alx1)
- [jeanmarc-leroux](https://gitlab.com/u/jeanmarc-leroux)
- [dnoe](https://gitlab.com/u/dnoe)
- [dblessing](https://gitlab.com/u/dblessing)
- [mechanicjay](https://gitlab.com/u/mechanicjay)
- [larsemil](https://gitlab.com/u/larsemil)
- [vga](https://gitlab.com/u/vga)
- [stanhu](https://gitlab.com/u/stanhu)
- [kohenkatz](https://gitlab.com/u/kohenkatz)
- [RavenB1](https://gitlab.com/u/RavenB1)
- [booksprint](http://forum.mattermost.org/users/booksprint/activity)
- [scottcorscadden](http://forum.mattermost.org/users/scottcorscadden/activity)
- [sskmani](http://forum.mattermost.org/users/sskmani/activity)
- [gosure](http://forum.mattermost.org/users/gosure/activity)
- [jigarshah](http://forum.mattermost.org/users/jigarshah/activity)

Extra special thanks to GitLab community leaders for successful release of GitLab Mattermost Alpha: 

- [marin](https://gitlab.com/u/marin)
- [sytse](https://gitlab.com/u/sytse) 


## Release v0.6.0 (Alpha) 

Released 2015-08-07

### Release Highlights

- Simplified on-prem install
- Support for GitLab Mattermost (GitLab SSO, Postgres support, IE 10+ support) 

### Compatibility

*Note: While use of Mattermost Preview (v0.5.0) and Mattermost Alpha (v0.6.0) in production is not recommended, we document compatibility considerations for a small number of organizations running Mattermost in production, supported directly by Mattermost product team.*

- Switched Team URLs from team.domain.com to domain.com/team 

### New Features 

GitLab Mattermost 

- OAuth2 support for GitLab Single-Sign-On
- PostgreSQL support for GitLab Mattermost users
- Support for Internet Explorer 10+ for GitLab Mattermost users

File and Image Sharing 

- New thumbnails and formatting for files and images

Messaging, Comments and Notifications 

- Users now see posts they sent highlighted in a different color
- Mentions can now also trigger on user-defined words 

Security and Administration 

- Enable users to view and log out of active sessions
- Team Admin can now delete posts from any user

On-boarding 

- “Off-Topic” now available as default channel, in addition to “Town Square” 

### Improvements

Installation 

- New "ByPassEmail" setting enables Mattermost to operate without having to set up email
- New option to use local storage instead of S3 
- Removed use of Redis to simplify on-premise installation 

On-boarding 

- Team setup wizard updated with usability improvements 

Documentation 

- Install documentation improved based on early adopter feedback 

### Contributors 

Many thanks to our external contributors. In no particular order: 

- [ralder](https://github.com/ralder)
- [jedisct1](https://github.com/jedisct1)
- [faebser](https://github.com/faebser)
- [firstrow](https://github.com/firstrow)
- [haikoschol](https://github.com/haikoschol)
- [adamenger](https://github.com/adamenger)

## Release v0.5.0 (Preview) 

Released 2015-06-24

### Release Highlights

- First release of Mattermost as a team communication service for sharing messagse and files across PCs and phones, with archiving and instant search.
 
### New Features

Messaging and File Sharing

- Send messages, comments, files and images across public, private and 1-1 channels
- Personalize notifications for unreads and mentions by channel
- Use #hashtags to tag and find messages, discussions and files

Archiving and Search 
 
- Search public and private channels for historical messages and comments 
- View recent mentions of your name, username, nickname, and custom search terms

Anywhere Access

- Use Mattermost from web-enabled PCs and phones
- Define team-specific branding and color themes across your devices
