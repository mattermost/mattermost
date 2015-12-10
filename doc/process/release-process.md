# Mattermost Release Process

Mattermost core team works on a monthly release process, with a new version shipping on the 16th of each month. 

This document outlines the development process for the Mattermost core team, which draws from what we find works best for us from Agile, Scrum and Software Development Lifecycle approaches.

Notes: 
- All cut-off dates are based on 10am PST (UTC-07/08) on the day stated. 
- T-minus counts are measured in "working days" (weekdays other than major holidays concurrent in US and Canada) prior to release day.

### (Code complete date of previous release) Beginning of release
- Pre-work for the current release begins at the code complete date of the previous release. See "Code Complete" section below for details.

### (T-minus 10 working days) Cut-off for major features
- No pull requests for major features should be submitted to the current release after this date (except if release manager decides to add "release-exception" label)
- (Ops) Post this checklist in Release channel 
- (PM) Write compatibility updates for config.json and database changes [See example](https://github.com/mattermost/platform/blob/master/CHANGELOG.md#compatibility)
- (PM) Confirm changes to config.json in compatibility section of Changelog are written back to [settings documentation](https://github.com/mattermost/platform/blob/master/doc/install/Configuration-Settings.md)
- (Dev) Prioritize reviewing, updating, and merging of pull requests for current release until there are no more tickets in the [pull request queue](https://github.com/mattermost/platform/pulls) marked for the current release 
- (Leads) Meets to prioritize the final tickets of the release
  - Backlog is reviewed and major features that won’t make it are moved to next release
  - Triage tickets
  - Finalize roadmap for next release
  - Draft roadmap for release after next (used to prioritize design tasks)
- (Marketing) Drafts marketing bullet points for next release based off of roadmap
- (Marketing) Submits pull request for "Highlights" section of the Changelog
- (Marketing) Notes date of announcements in release channel
- (PM) Update [Upgrade Guide](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md) for any steps needed to upgrade to new version
- (PM) Prepare tickets for [cutting RC builds](https://mattermost.atlassian.net/browse/PLT-985), [creating the final release candidate](https://mattermost.atlassian.net/browse/PLT-986), [creating AMIs](https://mattermost.atlassian.net/browse/PLT-1213), and [testing GitLab RC with Mattermost](https://mattermost.atlassian.net/browse/PLT-1013)
- (Stand-up) Each team member discusses worst bug (10-15s)

### (T-minus 8 working days) Feature Complete and Stabilization
- No pull requests for features can be submitted to the current release after this date (except if release manager add "release-exception" label to Jira ticket)
- (Ops) Post this checklist in Release channel 
- (Dev) Prioritize reviewing, updating, and merging of pull requests for current release until there are no more tickets in the [pull request queue](https://github.com/mattermost/platform/pulls) marked for the current release 
- **Stablization** period begins when all features for release have been committed. 
  - During this period, only **bugs** can be committed to master. Non-bug pull requests are tagged for next version and wait until after a release candidate is cut to be committed to master
  - (RM) Exceptions can be made by release manager by setting priority to "Highest" and labelling "release-exception", which will add ticket to [Hotfix list for release candidate](https://mattermost.atlassian.net/issues/?filter=10204).
  - (PM) Review all [Severity 1 bugs (data loss or security)](https://mattermost.atlassian.net/secure/IssueNavigator.jspa?mode=hide&requestId=10600) to consider for adding to Hotfix list. 
- (PM) Complete documentation 
  - (PM) Make Changelog PR with updates for latest feature additions and changes
  - (PM) Make Changelog PR with updates to contributors
  - (PM) Make NOTICE.txt PR for any new libraries added from dev, if not added already 
  - (PM) Prioritize any developer documentation tickets
  - (PM) Draft [GitLab ticket](https://gitlab.com/gitlab-org/omnibus-gitlab/issues/942) to take next Mattermost version in the Omnibus, but do not post until RC1 is cut
- (PM) Check testing is complete 
  - (PM) Works with Ops to check the [Quality Gate](https://github.com/mattermost/process/blob/master/release/quality-gates.md) for feature complete
  - (PM + Dev) Sign-off testing of their feature areas (i.e. PM/dev either signs-off that their area is well tested, or they flag that potential quality issues may exist)
- **(Team) Feature Complete Meeting (10:15am PST)**
  - (PM) Leads review of Changelog
  - (Team) Each team member discusses worst bug (10-15s) 
  - (PM) Review feature list for next release
  - (Marketing) Share draft of marketing announce for next release
- (Marketing) Communicates checklist of items needed by specific dates to write the blog post announce (e.g. screenshots, GIFs, 
- (Ops) Post Announce Date in Release channel + update the channel header to reflect date
- (Ops) Mail out mugs to any new contributors

### (T-minus 5 working days) Code Complete and Release Candidate Cut 
- (Ops) Post this checklist in Release channel 
- (Ops) For the next release, create team meetings on Feature Complete and Code Complete dates
- (PM) Remove "Under Development" notice for current release from Changelog on master 
- **(Team) Code Complete Meeting (10:15am PST meeting)** 
  - (Ops) Walks through each item of this checklist
  - (PM) Assigns each area of the release testing spreadsheet to a team member
  - (Dev) Last check of tickets that need to be merged before RC1
  - (Team) Each team member discusses worst bug (10-15s) 
- **Code Complete** is declared after meeting
  - (Dev) Prioritize reviewing, updating, and merging of pull requests for current release until there are no more tickets in the [pull request queue](https://github.com/mattermost/platform/pulls) marked for the current release 
  - (Build) Master is tagged and branched and “Release Candidate 1″ is cut (e.g. 1.1.0-RC1) according to the [Release Candidate Checklist](https://github.com/mattermost/process/blob/master/release/create-release-candidate.md)
  - (PM) Create meta issue for regressions in GitHub (see [example](https://github.com/mattermost/platform/issues/574))
  - (PM) Include link to meta-issue in release notes of RC1
  - (PM) Tweet announcement that RC1 is ready (see [example](https://twitter.com/mattermosthq/status/664172166368264192))
  - (PM) Submit GitLab ticket to take next Mattermost version in the Omnibus
  
### (T-minus 4 working days) Release Candidate Testing 
- (Team) Final testing is conducted by the team on the acceptance server and any issues found are filed
- (Build) Tests upgrade from previous version to current version, following the [Upgrade Guide](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md) 
  - Database upgrade should be tested on both MySQL and Postgres
 - (Ops) Posts copy of the **Release Candidate Testing** checklist into Town Square in PRODUCTION 
    - (Ops) Moves meeting, test and community channels over to the production version of RC, and posts in Town Square asking everyone to move communication over to the new team for testing purposes
    - (PM) Test feature areas and post bugs to Bugs/Issues in PRODUCTION 
    - (Ops) Runs through general testing checklist on RC1 and post bugs to Bugs/Issues in PRODUCTION 
   - (PM & DEV) Add **#p1** tag to any “Blocking” issue that looks like a hotfix to the RC is needed, and create a public ticket in Jira. Blocking issues are considered to be security issues, data loss issues, issues that break core functionality, or significantly impact aesthetics. 
- (PM) Updates the GitHub meta issue
  - (PM) Posts links to all issues found in RC as comments on the meta issue
  - (PM) Updates description to include approved fixes
  - (PM) Posts screenshot and link to final tickets for next RC to the Release room
  - (PM) Updates Release Notes with any new issues that will not be fixed for the current version
- (PM & DEV leads) Triage hotfix candidates and decide on whether and when to cut next RC or final
- (Dev) PRs for hotfixes made to release branch, and changes from release branch are merged into master
 - (Ops) Tests approved fixes on master
  - (Dev) Pushes next RC to acceptance after testing is complete and approved fixes merged
- (Dev) pushes next RC to acceptance and announces in Town Square on PRODUCTION 
  - (PM) closes the meta issue after the next RC is cut, and opens another ticket for new RC
- (Ops) verifies each of the issues in meta ticket is fixed
 - (PM) If no blocking issues are found, PM, Dev and Ops signs off on the release

### (T-minus 2 working days) Release Build Cut
- (Ops) Post this checklist in Release channel 
- (Build) Tags a new release (e.g. 1.1.0) and runs an official build which should be essentially identical to the last RC
 - (PM) Any significant issues that were found and not fixed for the final release are noted in the release notes
   - If an urgent and important issue needs to be addressed between major releases, a bug fix release (e.g. 1.1.1) may be created
- (PM) Copy and paste the Release Notes from the Changelog to the Release Description
- (PM) Update the mattermost.org/download page
- (PM) Update the AMI links on mattermost.org/installation
- (PM) Close final GitHub RC meta ticket
- (Dev) Delete RCs after final version is shipped
- (Marketing) Finalize marketing
  - (Marketing) Finalize mailchimp email blast
  - (Marketing) Finalize blog post and put on timer for release
  - (Marketing) Finalize tweet announcement
  - (Marketing) Finalize announcement on general mailing list
  - (Marketing) Finalize announcement for gitlab.mattermost.com
  
### (T-minus 0 working days) Release Day
- (Ops) Post this checklist in Release channel 
- (PM) Confirm marketing has been posted (animated GIFs, screenshots, mail announcement, Tweets, blog posts) 
- (PM) Close the release in Jira
- (PM) Set header of next release as UNDER DEVELOPMENT in CHANGELOG on master
- (Dev) Check if any libraries need to be updated for the next release, and if so bring up in weekly team meeting
- (Ops) Post key dates for the next release in the header of the Release channel
- (Ops) Queue an agenda item for next team meeting for Release Process Kaizen/Q&A
