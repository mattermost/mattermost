---
title: "Inactive contributions"
heading: "Manage inactive contributions at Mattermost"
description: "This process describes how inactive contributions are managed at Mattermost, inspired by the Kubernetes project."
date: 2017-08-20T12:33:36-04:00
weight: 3
aliases:
  - /contribute/getting-started/inactive-contributions
---

This process describes how inactive contributions are managed at Mattermost, inspired by the {{< newtabref href="https://github.com/kubernetes/kubernetes" title="Kubernetes project" >}}:

1. After 10 days of inactivity, a contribution becomes stale and a bot will add the `lifecycle/1:stale` label to the contribution.
    - If action is required from submitter, Community Coordinator asks if the team can help clarify previous feedback or provide guidance on next steps.
    - If action is required from reviewers, Community Coordinator asks reviewers to share feedback or help answer questions. The Coordinator will follow up with reviewers until a response is received.

2. After 20 days of inactivity, a contribution becomes inactive.
    - Community Coordinator asks the submitter if the team can help with questions. They acknowledge that after another 30 days of inactivity the contribution will be closed. They also add a `lifecycle/2:inactive` label to the contribution.
  {{<note "Note:">}}
  Contributions should never become orphaned because of reviewers. The Coordinator will be responsible for receiving a response from the reviewers during the stale period, which may be that the maintainers aren't able to accept the contribution in its current form.
  {{</note>}}
3. After 30 days of inactivity, a contribution becomes orphaned.
    - Community Coordinator notes that the contribution has been inactive for 60 days, thanks for the contribution and closes the contribution. They also add an `lifecycle/3:orphaned` label to the contribution, and adds an `Up For Grabs` label to the associated help wanted ticket, if appropriate.

Exceptions:

1. If the contribution is inactive but shouldn't be closed, the Coordinator adds a `lifecycle/frozen` label to the contribution. An example of this is when a design decision is being discussed but no decision has been arrived at yet.
2. Once the contribution reaches the `lifecycle/2:inactive` state, it is eligible to be assumed by another community member interested in working on the ticket.
3. Invalid PRs may be closed immediately without advancing through this lifecycle, especially if the contributor is unresponsive.
