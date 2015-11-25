# Mattermost

Mattermost is an open source, on-prem Slack-alternative. 

It offers modern communication from behind your firewall, including messaging and file sharing across PCs and phones with archiving and instant search.

## All team communication in one place, searchable and accessible anywhere

Please see the [features pages of the Mattermost website](http://www.mattermost.org/features/) for images and further description of the functionality listed below: 

#### Sharing Messaging and Files

- Send messages, comments, files and images across public, private and 1-1 channels
- Personalize notifications for unreads and mentions by channel and keyword
- Use #hashtags to tag and find messages, discussions and files

#### Archiving and Search 

- Import Slack user accounts and channel archives
- Search public and private channels for historical messages and comments 
- View recent mentions of your name, username, nickname, and custom search terms

#### Anywhere Access

- Use Mattermost from web-enabled PCs and phones
- Attach sound, video and image files from mobile devices 
- Define team-specific branding and color themes across your devices

#### Self-Host Ready

- Host and manage dozens of teams from a single Mattermost server 
- Easily manage your Mattermost server using a web-based System Console
- Script setup and maintenance using Mattermost command line tools 

## Learn More

- [Product Vision and Target Audiences](http://www.mattermost.org/vision/) - What we're solving and for whom are we building
- [Mattermost Forum](http://forum.mattermost.org/) - For technical questions and answers
- [Troubleshooting Forum](https://forum.mattermost.org/t/how-to-use-the-troubleshooting-forum/150) - For reporting bugs
- [Issue Tracker](http://www.mattermost.org/filing-issues/) - For reporting bugs
- [Feature Ideas Forum](http://www.mattermost.org/feature-requests/) - For sharing ideas for future versions 
- [Contribution Guidelines](https://github.com/mattermost/platform/blob/master/CONTRIBUTING.md) - For contributing code or feedback to the project

Follow us on Twitter at [@MattermostHQ](https://twitter.com/mattermosthq), or talk to the core team on our [daily builds server](https://pre-release.mattermost.com/core) via [this invite link](https://pre-release.mattermost.com/signup_user_complete/?id=rcgiyftm7jyrxnma1osd8zswby). 

## Installing Mattermost

Latest stable release of Mattermost is available from http://www.mattermost.org/download/, including binary distribution, and from install guides below. 

If you use Docker, you can [install Mattermost in a single-container preview in one line](https://github.com/mattermost/platform/blob/master/doc/install/Docker-Single-Container.md#one-line-docker-install). 

#### Quick Start Install for Product Evaluation 

- [Local Machine Install with Docker](https://github.com/mattermost/platform/blob/master/doc/install/Docker-Single-Container.md) - Explore product functionality using a single-container Docker install on a local machine, including Mac OSX, Ubuntu, or Arch Linux). Optionally set up email and upgrade your instance using DockerHub. 

- [AWS EBS Install with Docker](https://github.com/mattermost/platform/blob/master/doc/install/Amazon-Elastic-Beanstalk.md) - Explore product functionality using a single-container Docker install for Amazon Web Services Elastic Beanstalk. Optionally set up email and upgrade your instance using DockerHub. 

#### Development Install 

- [Developer Machine Setup](https://github.com/mattermost/platform/blob/master/doc/developer/Setup.md) - Setup your local machine development environment using Docker on Mac OSX or Ubuntu. Pull the latest stable release or pull the latest code from our development build.

[![Build Status](https://travis-ci.org/mattermost/platform.svg?branch=master)](https://travis-ci.org/mattermost/platform)

#### Production Deployment

Prior to production installation, please review [Mattermost system requirements](https://github.com/mattermost/platform/blob/master/doc/install/Requirements.md). 

- [Production Install on Ubuntu 14.04](https://github.com/mattermost/platform/blob/master/doc/install/Production-Ubuntu.md) - Install Mattermost for production environments. 

- [GitLab Mattermost Production Installation](https://gitlab.com/gitlab-org/gitlab-mattermost) - Install Mattermost for production environments bundled with GitLab, a leading open source Git repository, using an omnibus package for Ubuntu 12.04, Ubuntu 14.04, Debian 7, Debian 8, and CentOS 6 (and RedHat/Oracle/Scientific Linux 6), CentOS 7 (and RedHat/Oracle/Scientific Linux 7). 

For technical questions and answers, please visit the [Troubleshooting Forum](https://forum.mattermost.org/c/general/trouble-shoot).

## Get Involved with Mattermost 

Joining the Mattermost community is a great way to build relationships with other talented and like-minded professionals, increase awareness of the interesting work you are doing, and sharpen your skills. Here are some of the ways that you can make a difference in the Mattermost ecosystem:

#### Discuss

- Visit the [Mattermost Forum](http://forum.mattermost.org/) for technical questions and answers. 

#### Review

- Share feedback on [Mattermost Design Feedback Requests](http://forum.mattermost.org/c/feature-ideas/specifications), which offer early previews of designs community comments and feedback. 
- Visit the [Feature Ideas Forum](http://mattermost.uservoice.com/forums/306457-general) and consider upvoting community feature ideas, which are reviewed for each monthly release.

#### Share

- Blog about your Mattermost experiences and use cases, either on your personal blog, the [Mattermost forum](http://forum.mattermost.org), or contribute a guest post to the [Mattermost blog](http://www.mattermost.org/category/blog/). If you write about Mattermost. please contact our community team at info@mattermost.com for help promoting your content.
- Tweet to share with your community and friends why you use Mattermost. Follow [@MattermostHQ](https://twitter.com/mattermosthq) on Twitter and conversations on [#mattermost](https://twitter.com/search?q=%23mattermost&src=typd).

#### Write

- As with most open source projects, Mattermost documentation is maintained in a public repository. You can propose changes by [submitting pull requests (no programming skills required)](http://forum.mattermost.org/t/help-improve-mattermost-documentation/194). We highly welcome you to add improvements, write guides and tutorials, and expand on sections. 
- Prior to contributing, please review [Mattermost Documentation Guidelines](http://www.mattermost.org/documentation-guidelines/), which include standards on writing Mattermost documentation for a global audience, who might not use English as their first language.

#### Contribute

- Share [feature ideas](http://www.mattermost.org/feature-requests/) with the Mattermost community
- Review the [Mattermost Code Contribution Guidelines](https://github.com/mattermost/platform/blob/master/CONTRIBUTING.md) to submit patches for the core product
- Build [community applications](http://www.mattermost.org/community-applications/) using Mattermost [webhooks, drivers and APIs](https://github.com/mattermost/platform/blob/master/doc/developer/API.md)
- Create new [community installers and guides](http://www.mattermost.org/installation/#community-install-guide) for Mattermost 


##### Check out some projects for connecting to Mattermost: 

- [Matterbridge](https://github.com/42wim/matterbridge) - an IRC bridge connecting to Mattermost 
- [GitLab Integration Service for Mattermost](https://github.com/mattermost/mattermost-integration-gitlab) - connecting GitLab to Mattermost via incoming webhooks
- [Giphy Integration Service for Mattermost](https://github.com/mattermost/mattermost-integration-giphy) - connecting Mattermost to Giphy via outgoing webhooks
- [node-mattermost](https://github.com/jonathanwiesel/node-mattermost) - a node.js module for sending and receiving messages from Mattermost webhooks
- [matterqus](https://github.com/jonathanwiesel/matterqus) - Disqus comment notifier for Mattermost

#### Have other ideas or suggestions?

If there’s some other way you’d like to contribute, please contact us at info@mattermost.com. We’d love to meet you!
