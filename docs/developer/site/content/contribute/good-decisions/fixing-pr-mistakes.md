---
title: "When a merged PR results in a bug"
heading: "When a merged PR results in a bug"
weight: 2
---

This page describes the process to follow when someone notices a mistake in a merged pull request (PR).

1. A contributor (either staff or community member) submits a PR, it is reviewed and merged into the codebase.
2. Sometime later, the community notices a mistake with the PR.

Question is, what should we, as a community, do? That depends on the scope of the changes in the PR that was merged.

## Low impact issues
A low impact PR might mean that it affected:
- Some non-critical functionality.
- It doesn't affect users in a substantial way.

If this is the case, do the following:

1. Capture details in an issue.
2. Mark it according to its priority.
3. Would be best to assign it to the person who introduced the issue in the first place.

## High impact issues
A high impact PR represents something that has or will result in a customer incident.

If this is the case, there are two scenarios:

1. The feature introduced in the PR is handled by a feature flag.
2. The feature introduced in the PR is **not** handled by a feature flag. 

For scenario 1, if it's not affecting other functionality, turn that feature flag off to disable the feature.

For scenario 2:

1. Revert the changes introduced in the original PR.
2. Notify the person who worked on the PR so they can work on a proper fix for their PR.
3. Reintroduce the change through the regular PR cycle.
