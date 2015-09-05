# Mattermost Changelog

## Release v0.7.0 (Beta1) 

Released 2015-09-05

### Release highlights

#### Improved GitLab Mattermost support 

Following the release of Mattermost v0.6.0 Alpha, GitLab 7.14 offered an automated install of Mattermost with GitLab Single-Sign-On (co-branded as "GitLab Mattermost") in its omnibus installer.

New features, improvements, and bug fixes recommended by the GitLab community were incorporated into Mattermost v0.7.0 Beta1--in particular, extending support of GitLab SSO to team creation, and restricting team creation to users with verified emails from a configurable list of domains.

#### Slack Import (Preview)

Preview of Slack import functionality supports the processing of an "Export" file from Slack containing account information and public channel archives from a Slack team.   
- In the feature preview, emails and usernames from Slack are used to create new Mattermost accounts, which users can activate by going to the Password Reset screen in Mattermost to set new credentials. Once logged in, users will have access to previous Slack messages shared in public channels, now imported to Mattermost.  

Limitations: 
- Slack does not currently export any files or images that your team has stored in the Slack database. Mattermost will provide links to the location of your assets in Slack's web UI.
- Slack does not currently export any content from your private groups or direct messages that your team has stored in the Slack database. 
- The Preview release of Slack Import does not offer pre-checks or roll-back and will not import Slack accounts with username or email address collisions with existing Mattermost accounts. Also, Slack channel names with underscores will not import. These issues are being addressed in Mattermost v0.8.0.
  
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

Special thanks to GitLab Mattermost early adopter community for issue reports and feedback. In no particular order: 

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

Extra special thanks to GitLab community leaders for successful release of GitLab Mattermost Alpha: 
- [marin](https://gitlab.com/u/marin)
- [sytse](https://gitlab.com/u/sytse) 


## Release v0.6.0 (Alpha) 

Released 2015-08-07

### Release highlights

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

### Release highlights

- First release of Mattermost as a team communication service for sharing messagse and files across PCs and phones, with archiving and instant search.
 
### New Features

- Sharing Messaging and Files
 - Send messages, comments, files and images across public, private and 1-1 channels
 - Personalize notifications for unreads and mentions by channel
 - Use #hashtags to tag and find messages, discussions and files

- Archiving and Search 
 - Search public and private channels for historical messages and comments 
 - View recent mentions of your name, username, nickname, and custom search terms

- Anywhere Access
 - Use Mattermost from web-enabled PCs and phones
 - Define team-specific branding and color themes across your devices
