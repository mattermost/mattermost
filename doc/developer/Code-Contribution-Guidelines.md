# Code Contribution Guidelines

Thank you for your interest in contributing to Mattermost. This guide provides an overview of important information for contributors to know. 

## Choose a Ticket

1. Review the list of [Good First Contribution](https://mattermost.atlassian.net/issues/?filter=10206) tickets listed in Jira. 

2. These projects are intended to be a straight forward first pull requests from new contributors. 
If you don't find something appropriate for your interests, please see the full list of tickets [Accepting Pull Requests](https://mattermost.atlassian.net/issues/?filter=10101). 

3. If you have any questions at all about a ticket, please post to the [Contributor Discussion section](http://forum.mattermost.org/) of the Mattermost forum, or email the [Mattermost Developer Mailing list](https://groups.google.com/a/mattermost.com/forum/#!forum/developer/join). 

## Install Mattermost and set up a Fork

1. Follow [developer setup instructions](https://github.com/mattermost/platform/blob/master/doc/install/dev-setup.md) to install Mattermost. 

2. Create a branch with <branch name> set to the ID of the ticket you're working on, for example ```PLT-394```, using command: 

```
git checkout -b <branch name>
```

## Programming and Testing 

1. Please review the [Mattermost Style Guide](Style-Guide.md) prior to making changes.

   To keep code clean and well structured, Mattermost uses ESLint to check that pull requests adhere to style guidelines for React. Code will need to follow Mattermost's React style guidelines in order to pass the automated build tests when a pull request is submitted.
   
2. Please make sure to thoroughly test your change before submitting a pull request. 

## Submitting a Pull Request 

1. Please add yourself to the Mattermost [approved contributor list](https://docs.google.com/spreadsheets/d/1NTCeG-iL_VS9bFqtmHSfwETo5f-8MQ7oMDE5IUYJi_Y/pubhtml?gid=0&single=true) prior to submitting by completing the [contributor license agreement](http://www.mattermost.org/mattermost-contributor-agreement/). 

2. When you submit your pull request please include the Ticket ID at the beginning of your pull request comment, followed by a colon. 

  For example, for a ticket ID `PLT-394` start your comment with:  `PLT-394:`. See [previously closed pull requests](https://github.com/mattermost/platform/pulls?q=is%3Apr+is%3Aclosed) for examples. 

3. Once submitted, your pull request will be checked via an automated build process and will be reviewed by the Mattermost core team, who may either accept the PR or follow-up with feedback.

4. If you've included your mailing address in Step 1, you'll be receiving a [Limited Edition Mattermost Mug](http://forum.mattermost.org/t/limited-edition-mattermost-mugs/143) as a thank you gift after your first pull request has been accepted. 




