# Mattermost Changelog

## UNDER DEVELOPMENT - Release v1.1.0

-The "UNDER DEVELOPMENT" section of the Mattermost changelog appears in the product's `master` branch to note key changes committed to master and are on their way to the next stable release. When a stable release is pushed the "UNDER DEVELOPMENT" heading is removed from the final changelog of the release. 
-
-- **Final release anticipated:** 2015-10-16

### Release Highlights

#### Incoming Webhooks

Mattermost now supports incoming webhooks for channels and private groups. This developer feature is available from the Account Settings -> Integrations menu. Documentation on how developers can use the webhook functionality to build custom integrations, along with samples, is available at http://mattermost.org/webhooks. 

### Improvements

Integrations

- Improved support for incoming webhooks, including the ability to override a username and post as a bot instead

Documentation

- Contents of `/docs` now hosted at docs.mattermost.org
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

- Fixed issue so that SSO option automatically set EmailVerified=true (it was false previously)

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
