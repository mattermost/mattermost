# Development Process Overview

This document describes the process through which feedback and design discussions flow into community systems, then into tickets, then into pull requests, then into monthly releases based on the purpose of the product. 

## Purpose

The core offer for users of Mattermost is: 

- **All your team communication in one place, searchable and accessible anywhere.**

The design is successful if 100% of team members use Mattermost for internal communications, and are largely off of email and propreitary SaaS products that lock-in user data as part of their business model. 

See [Mattermost scope statement](http://www.mattermost.org/vision/#mattermost-teams-v1) for more details. 

## Community Systems 

The process for managing bugs, feature ideas, troubleshooting, and general discussions are different, so different systems are used to best support each process. Each system ties into Mattermost through notifications to internal channels, so the core team and key contributors can keep up-to-date with community feedback across all systems throughout the day.

Systems include: 

###  Feature Idea Forum 

A forum for filing, upvoting and discussing feature ideas. Reviewed monthly by the core team as part of the planning process for new releases. 

See [Contributing Feature Ideas](http://www.mattermost.org/feature-requests/) for more details on how to use this system. 

_Note: If you want to promote an idea filed in the feature idea forum, or if you are out of votes and want to find like-minded colleagues to vote for you, consider posting to the [Feature Idea Discussion ](https://forum.mattermost.org/t/how-to-use-feature-idea-discussion/63/1) category in the General Forum._


###  Troubleshooting Forum 

A system for peer-to-peer support of installation and configuration questions. 

See [Troubleshooting Forum](https://forum.mattermost.org/t/about-the-trouble-shooting-category/150/1).


### GitHub Issues 

A system primarily used by Mattermost for reporting bugs with clear statements on repro steps and expected behavior. While it's okay to add feature requests and questions here to start conversations, moderators may ask a submitter's help to move discussions to one of the other channels. 

See [Filing Issues](http://www.mattermost.org/filing-issues/) for details on how to file issues for Mattermost in GitHub.

Please consider using more mainstream processes for [filing feature ideas to be upvoted](https://github.com/mattermost/platform/blob/master/doc/process/overview.md#feature-idea-forum), to ask [troubleshooting questions](https://github.com/mattermost/platform/blob/master/doc/process/overview.md#troubleshooting-forum), or [general questions](https://github.com/mattermost/platform/blob/master/doc/process/overview.md#general-forum). 

### GitHub Pull Requests 

A system for submitting pull requests for changes to Mattermost. See [Pull Requests](https://github.com/mattermost/platform/blob/master/doc/process/overview.md#merge-requests) section below. 

### General Forum 

A general, peer-to-peer discussion forum with topics organized by category for general questions, trouble shooting, design feedback requests, and FAQs. Monitored and moderated by core team, which is also active on the forum.

Read more about the [General Forum](https://forum.mattermost.org/t/welcome-to-mattermost-community-discussion/8). 

### Primary Research 

Core team members and key contributors may discuss Mattermost directly with users in a range of systems outside those listed here--in-person meetings, video-conference, usability testing, Twitter, email, etc. Those notes are shared in various Mattermost channels to inform designs. 

## Tickets

Mattermost priorities are managed in Jira tickets, which are created by the core team via feedback from community systems as well as through the planning processes. 

### Triage

On non-holiday weekdays new tickets are reviewed in a process called "triage", and assigned a Fix Version of "backlog", indicating the ticket has enough specificity that it can be assigned to a developer to be completed. 

By default, all tickets are created as public unless they contain sensitive information. The triage process reviews them for sufficient specifity. If the ticket is unclear, triage may reassign the ticket back to the original reporter to add more details. 

View [current issues scheduled for the next triage meeting](https://mattermost.atlassian.net/browse/PLT-1203?filter=10105). 

#### Re-triage 

If someone feels an existing ticket should be reexamined, they can add "triage" to the Fix Version and it will be routed to the triage team for review at the next meeting. 

### Release Planning

Release planning sets the "Fix Version" of tickets to one of the upcoming monthly releases. The Fix Version is an estimate of when a feature might ship, which may change as the planning process continues, until the ticket is scheduled for a Sprint.

### Sprint Planning

Tickets to be completed in the upcoming two weeks are organized on Tuesdays, with input from developers, and finalized on Fridays.

## Pull Requests

### Core Team Weekly Rhythm 

Core team work on tickets in the active sprint on a weekly basis, which flow into GitHub Pull Requests.

Each Pull Request needs a minimum of two reviews by other core team developers before it is merged, with possible feedback shared as reviews happen. 

Key contributors might also pick up tickets, or through conversations with the core team contribute pull requests as needed. 

### Community Contributions 

Community members following the [Contribution Guidelines](https://github.com/mattermost/platform/blob/master/CONTRIBUTING.md) might also submit pull requests. Pull requests should not disable existing functionality without a Jira ticket, which are opened [via the feature ideas process](http://www.mattermost.org/feature-requests/). 

#### Bug Fixes 

If you see an obvious bug and want to submit a fix, pull requests following the [contribution guidelines](https://github.com/mattermost/platform/blob/master/CONTRIBUTING.md) are gladly accepted. 

Examples: 
- [Fix: Unable to change password #1390](https://github.com/mattermost/platform/pull/1390)
- [Fix isBrowserEdge typo #1260](https://github.com/mattermost/platform/pull/1260)

#### Tickets Accepting Pull Requests

If you'd like to improve the product beyond bug fixes, you can select from a list of tickets accepting pull requests prepared by the core team. 

Tickets labelled "accepting pull requests" are intended to be unambiguous projects that could be reasonably completed by contributors outside the core team and are welcome contributions. 

Tickets may have a "mana" value assigned, which is an estimate of the relative complexity of each ticket (2 is "small", "4" is medium, "8" is large). 

Even if the ticket is assigned to someone else, so long as the ticket has Status set to Open and the ticket is not in the [Active Sprint](https://mattermost.atlassian.net/browse/PLT-839?jql=status%20%3D%20Open%20AND%20sprint%20in%20openSprints%20()) contributors following the contribution guidelines are welcome to submit pull requests. 

For a list of tickets that meet this criteria, please the list of [Tickets Accepting Pull Requests](https://mattermost.atlassian.net/browse/PLT-1263?filter=10101).

#### Documentation Improvements 

Improvements to documentation on master is highly welcome. 

Please see [documentation contribution guidelines](https://forum.mattermost.org/t/help-improve-mattermost-documentation/194) for more details. 

Examples: 
- [Production installation instructions for Debian Jessie with Systemd #1134](https://github.com/mattermost/platform/pull/1134)
- [Fix deadlink to AWS file in doc #622]( https://github.com/mattermost/platform/pull/622)

#### Minor Improvements 

Minor improvements without an Accepting Pull Request ticket may be accepted if: 

1. The contribution aligns with product scope 
2. The change is high quality, and does not impose a significant burden for others to test, document and maintain your change.
3. The change aligns with the [fast, obvious, forgiving](http://www.mattermost.org/design-principles/) design principle.

Examples: 
- [Do not clear LastActivityAt for GetProfiles #1396](https://github.com/mattermost/platform/pull/1396/files)
- [Update to proxy_pass #1331](https://github.com/mattermost/platform/pull/1331)

## Release

Mattermost ships stable releases on the 16th of the month. Releases begin with a planning process reviewing internal designs and community feedback in the context of the product purpose. Feature development is done in weekly sprints, and releases end with feature complete, stablization, code complete and release candidate milestones prior to final release. 

See [release process documentation](https://github.com/mattermost/platform/blob/master/doc/process/release-process.md) for more details. 
