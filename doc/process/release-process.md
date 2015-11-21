We're working on making internal processes in the Mattermost core team more transparent for the community. Below is a working draft of our software development process, which will be updated live as we refine our process.

Questions, feedback, comments always welcome, 

----------

Mattermost core team works on a monthly release process, with a new version shipping on the 16th of each month. 

This document outlines the development process for the Mattermost core team, which draws from what we find works best for us from Agile, Scrum and Software Development Lifecycle approaches.

This is a working document that will update as our process evolves.


### - Beginning of release
- (Ops) Queue an agenda item for first team meeting of the release to review Roadmap

### - (10 weekdays before release date) Cut-off for major features
- No major features can be committed to the current release after this date
- (Dev) Prioritize reviewing, updating, and merging of all pull requests that are going to make it into the release 
  - There should be no more tickets in the [pull request queue](https://github.com/mattermost/platform/pulls) marked for the current release
- (Leads) Meets to prioritize the final tickets of the release
  - Backlog is reviewed and major features that won’t make it are moved to next release
  - Triage tickets
  - Review roadmap for next release
- (Marketing) Writes the "Highlights" section of the Changelog
- (PM) Write compatibility updates for config.json and database changes [See example](https://github.com/mattermost/platform/blob/master/CHANGELOG.md#compatibility)
- (PM) Update [Upgrade Guide](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md) for any steps needed to upgrade to new version
- (PM) Prepare tickets for cutting RCs builds, filing issue in GitLab omnibus to take RC candidate, testing GitLab RC with Mattermost
- (Stand-up) Each team member discusses worst bug
 
### - (8 weekdays before release date) Feature Complete and Stabilization
- After the cut-off time for Feature Complete, Dev prioritizes reviewing PRs and committing to master so Stabilization period can begin, with testing and high priority bug fixes
- During Stabilization period only BUGS can be committed to master, non-bug tickets are tagged for next version and wait until after a release candidate is cut to be added to master
  - (PM) Review all [S1 bugs](https://mattermost.atlassian.net/secure/IssueNavigator.jspa?mode=hide&requestId=10600) and mark important ones as high priority
  - (Dev + PM) Exceptions can be made by triage team consensus across PM and Dev. List of approved changes for release candidate 1 here: https://mattermost.atlassian.net/issues/?filter=10204
- (PM) Documentation 
  - (PM) Make Changelog PR with updates for latest feature additions and changes
  - (PM) Make Changelog PR with updates to contributors
  - (PM) Make NOTICE.txt PR for any new libraries added from dev, if not added already 
  - (PM) Prioritize any developer documentation tickets
- (PM and devs) Sign-off testing of their feature areas (i.e. PM/dev either signs-off that their area is well tested, or they flag that potential quality issues may exist)
- (Ops) Mail out mugs to any new contributors
- (Team) Select "Top Contributor" for the release from external contributions to be mentioned in release announcement
- (Marketing) Decides announce date (discuss in meeting)
- (Ops) Post Announce Date in Release channel + update the channel header to reflect date
- (Marketing) Communicates checklist of items needed by specific dates to write the blog post announce (e.g. screenshots, GIFs, documentation) and begins to write the blog post, tweet, and email for the release announcement
- (PM) Works with Ops to check the Quality Gate for feature complete
- (PM) Communicate to team the plan for next release
- (Stand-up) Each team member discusses worst bug

### - (5 weekdays before release date) Code Complete and Release Candidate Cut 
- (Team) Meets to discuss release at 10am PST 
  - (PM) Each area changed in latest release is assigned a PM owner to lead testing
  - (Ops) Walks through each item of the **Code Complete and Release Candidate Cut** checklist
  - (Dev) Last check of tickets that need to be merged before RC1
  - (Team) Each team member discusses worst bug
- After 10am PST meeting the release is considered “Code Complete”. 
  - (Dev) Completes final reviews and updates of PRs marked for the release version 
    - There should be no more tickets in the [pull request queue](https://github.com/mattermost/platform/pulls) marked for the current release
  - Master is tagged and branched and “Release Candidate 1″ is cut (e.g. 1.1.0-RC1) according to the Release Candidate Checklist
  - (PM) Create meta issue for regressions in GitHub (see [example](https://github.com/mattermost/platform/issues/574))

### - (4 weekdays before release date) Release Candidate Testing 
- Final testing is conducted by the team on the acceptance server and any issues found are filed
 - (Dev) Tests upgrade from previous version to current version, following the [Upgrade Guide](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md) 
 - (Ops) Posts copy of the **Release Candidate Testing** checklist into Town Square in PRODUCTION 
    - (Ops) Moves meeting, test and community channels over to the production version of RC, and posts in Town Square asking everyone to move communication over to the new team for testing purposes
    - (PM) Test feature areas and post bugs to Bugs/Issues in PRODUCTION 
    - (Ops) Runs through general testing checklist on RC1 and post bugs to Bugs/Issues in PRODUCTION 
   - (PM & DEV) Add **#p1** tag to any “Blocking” issue that looks like a hotfix to the RC is needed, and create a public ticket in Jira. Blocking issues are considered to be security issues, data loss issues, issues that break core functionality, or significantly impact aesthetics. 
- (PM) Updates the GitHub meta issue
  - (PM) Posts links to all issues found in RC as comments on the meta issue
  - (PM) Updates description to include approved fixes
  - (PM) Posts screenshot and link to final tickets for next RC to the Release room
- (PM & DEV leads) Triage hotfix candidates and decide on whether and when to cut next RC or final
- (Dev) PRs for hotfixes made to release branch, and changes from release branch are merged into master
 - (Ops) Tests approved fixes on master
  - (Dev) Pushes next RC to acceptance after testing is complete and approved fixes merged
- (Dev) pushes next RC to acceptance and announces in Town Square on PRODUCTION 
  - (PM) closes the meta issue after the next RC is cut, and opens another ticket for new RC
- (Ops) verifies each of the issues in meta ticket is fixed
 - (PM) If no blocking issues are found, PM, Dev and Ops signs off on the release

### - (2 weekdays before release date) Release
 - (Dev) Tags a new release (e.g. 1.1.0) and runs an official build which should be essentially identical to the last RC
 - (PM) Any significant issues that were found and not fixed for the final release are noted in the release notes
  - If an urgent and important issue needs to be addressed between major releases, a hotfix release (e.g. 1.1.1) may be released, however this should be very rare, given a monthly cadence
 - (PM) Copy and paste the Release Notes from the Changelog to the Release Description
 - (PM) Update the mattermost.org/download page
 - (Dev) Delete RCs after final version is shipped
 - (PM) Close final GitHub RC meta ticket

### - (0 weekdays before release date) End of Release
- (PM) Makes sure marketing has been posted (animated GIFs, screenshots, mail announcement, Tweets, blog posts) 
- (PM) Close the release in Jira
- (Dev) Check if any libraries need to be updated for the next release, and if so bring up in weekly team meeting
- (Ops) Post important dates for the next release in the header of the Release channel
- (Ops) Queue an agenda item for next team meeting for "Stepping Back" Q&A
- (Ops) Queue an agenda item for next team meeting for Roadmap review
