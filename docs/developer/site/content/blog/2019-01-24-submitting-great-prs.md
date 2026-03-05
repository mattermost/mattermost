---
title: "Submitting Great PRs"
heading: "How to Submit Great PRs"
description: "Learn how to submit optimal pull requests to increase the chances your contributions are added to open source projects."
slug: submitting-great-prs
aliases: [/blog/2019-01-24-submitting-great-prs]
date: 2019-01-24T00:00:00-04:00
categories:
    - "contributing"
author: Jesse Hallam
github: lieut-data
community: jesse.hallam
---

If you want to submit good pull requests, start with our [contribution checklist](https://developers.mattermost.com/contribute/getting-started/contribution-checklist/). Today, that page talks about what to fork, how to style your code, how to write unit tests and where to push your code. Implicit in all of that is the need to write great code, of course!

But this blog post isn't about writing great code, it's about making your pull request a great experience for you and your reviewers.

I still remember my first pull request a few days into my first software engineering internship. Without even looking at my code, my mentor sat me down and said something like this, "Jesse, before you ask anyone else to review your code, I want you to review it yourself." He asked me to read through my code and make comments just like a real reviewer, and then we would review the remainder together.

I am forever grateful to my mentor for shaping my thinking about reviewing code. Having given more than a few reviews since then, let me share some advice starting with what my mentor taught me:

### 1) Review your own code first.

Be the one to catch styling issues. Be the one to ask, "Does this variable name make any sense?" Be the one to identify problem areas and points of confusion. Be the first reviewer.

Now, not everything deserves to be fixed in every pull request. Fixing a one-line bug isn't usually the time to fix an unrelated variable naming issue that touches multiple files. This leads to my second point:

### 2) Give a great description.

The description on a pull request is your chance to prove to a reviewer that you have the credentials to fix this problem. How? State the problem in your own words:

> This pull request adds new functionality to expose ...

Tell the reviewer why we need to do this:

> With this new functionality, we can fix a longstanding customer issue that ...

You don't need to outline everything your code is doing -- that's why the code is there -- but this is also your opportunity to point the reviewer in the right direction:

> The trickiest part of this pull request was the `SqlStore` changes, because ...

and also:

> I really wanted to fix the variable names in this file, but it's out of scope for this pull request.

Of course, sometimes you have to fix something else before you can get to the issue at hand. Maybe you decide to fix that variable name problem because it clarifies the feature you're adding. On to my third point:

### 3) Clean up your history.

Everyone has their own development style. Mine usually consists of coding a small part of the overall problem, typing:

```sh
git commit -m wip
```

and repeating this process often. Commit early and commit often! It's just easier to undo changes this way while you're actively developing.

But a reviewer doesn't need to see that commit history. As a reviewer myself, I'd want to see one of two things. Either:

1. A single squashed commit with all of your changes.

2. Multiple commits breaking up your changes into logical groupings.

Put that variable name fix in its own commit, commit your feature change on top of it, and add a note to your PR's description. Your reviewers can then use the commits tab in GitHub to review those changes independently.

Maybe you're the kind of developer that writes a pristine commit history the first time, but most of us rely on `git rebase`. If you aren't familiar with rebasing, it might seem terrifying or magical, but it doesn't need to be: play with it, master it, and use it often. If you need help getting started here, check out Atlassian's excellent {{< newtabref href="https://www.atlassian.com/git/tutorials/rewriting-history/git-rebase" title="tutorial on git rebase" >}}.

Keep in mind though that rebasing is something to do before you submit your pull request, not after, and this leads to my last point:

### 4) Avoid Force Pushing

Good git etiquette is to avoid force pushing any branch someone else is actively using or reviewing. A pull request is a branch just like any other, so once you've started that pull request, everything that you push upstream should just be a regular or merge commit. In particular, when merge conflicts arise with `master`, just:

```sh
git fetch && git merge origin/master
```

Resolve the conflicts and push up the resulting merge commit. Resist the urge to rebase anything you've already pushed to the pull request.

Why? When you rebase, you are effectively replaying a commit history on top of another commit. But in a pull request, a reviewer wants to see a linear history of your changes from when they started reviewing. Any merge conflicts resolved during the rebase operation are "hidden" inside the original commits instead of appearing as a new commit. A diligent reviewer must then start from the beginning instead of just examining the latest changes. Exacerbating all of this is that GitHub tends to lose or detach comment threads across a rebase, making it difficult to regain context from an earlier discussion.

Note that other open source projects may merge your commit history instead of squashing it as we do here at Mattermost. Always check with the project maintainers for best practices regarding pull requests.

I hope these four points are useful! Keep in mind, too, that you don't have to be a core committer with Mattermost to review someone else's code. If there's a pull request that interests you and you have some useful context to share, jump in and give a review, and I think you'll appreciate some of these points even better.
