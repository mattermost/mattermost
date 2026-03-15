---
title: "Feature flags"
heading: "Feature flags and Mattermost Cloud"
description: "Feature flags allow us to be more confident in shipping features continuously to Mattermost Cloud. Find out why."
date: 2020-10-15T16:00:00-0700
weight: 3
aliases:
  - /contribute/server/feature-flags
---

# What are feature flags

Feature flag is a software development technique that turns functionality on and off without deploying new code. Feature flags allow us to be more confident in shipping features continuously to Mattermost Cloud. Feature flags also allow us to control which features are enabled on a cluster level.

# How to use feature flags

## When to use

There are no hard rules on when a feature flag should be used. It is left up to the best judgement of the responsible engineers to determine if a feature flag is required. The following are guidelines designed to help the determination:

- Any "substantial" feature should have a flag
- Features that are probably substantial:
    - Features with new UI or changes to existing UI
    - Features with a risk of regression
- Features that are probably not substantial:
    - Small bug fixes
    - Refactoring
    - Changes that are not user facing and can be completely verified by unit and E2E testing.

In all cases, ask yourself: Why do I need to add a feature flag? If I don't add one, what options do I have to control the impact on user experience (e.g. a config setting or System Console setting)?

## Add the feature flag in code

1. Add the new flag to the feature flag struct located in `model/feature_flags.go`.
2. Set a default value in the `SetDefaults` function in the same file.
3. Use the feature flag in code as you would use a regular configuration setting. In tests, manipulate the configuration value to test value changes, such as activation and deactivation of the feature flag.
4. Code may be merged regardless of setup in the management system. In this case it will always take the default value supplied in the `SetDefaults` function.
5. Create a removal ticket for the feature flag. All feature flags should be removed as soon as they have been verified by Cloud. The ticket should encompass removal of the supporting code and archiving in the management system.

### Feature flag code guidelines

- A ticket should be created when a feature flag is added to remove the feature flag as soon as it isn't required anymore.
- Tests should be written to verify the feature flag works as expected. Note that in cases where there may be a migration or new data, off to on and on to off should both be tested.
- Log messages by the feature should include the feature flag tag, with the feature flag name as a value, in order to ease debugging.

# Changing Feature Flag Values

## Self Hosted (and local development)

Feature flag values can be changed via environment variables. The environment variable set follows the pattern `MM_FEATUREFLAGS_<name>` where `<name>` is the uppercase key of the feature flag you added to model/feature_flags.go

## Cloud

Feature flag adjustments (ie, turning something on or off) in the Mattermost Cloud environment are owned and controlled by the Cloud team. To change the value for a feature flag, please open a ticket.

## Timelines for rollouts

Typically feature flag will initially disable the feature. It's a good idea to test the feature during a safe time or on a subset of instances. Each team can decide what's best and there's no need to request the flag value changes from the Cloud team. If you think there might be a performance impact there's no harm in communicating your plan beforehand.

{{<note "Note:">}}
The steps below are an initial guideline and will be iterated on over time.

 - 1st week after feature is merged (T-30): 10% rollout; only to test servers, no rollout to customers.
 - 2nd week (T-22): 50% rollout; rollout to some customers (excluding big customers and newly signed-up customers); no major bugs in test servers.
 - 3rd week (T-15): 100% rollout; no major bugs from customers or test servers.
 - End of 3rd week (T-8): Remove flag. Feature is production ready and not experimental.
{{</note>}}

For smaller, non-risky features, the above process can be more fast tracked as needed, such as starting with a 10% rollout to test servers, then 100%.
Features have to soak on Cloud for at least two weeks for testing. Focus is on severity and number of bugs found; if there are major bugs found at any stage, the feature flag can be turned off to roll back the feature.

When the feature is rolled out to customers, logs will show if there are crashes, and normally users will report feedback on the feature (e.g. bugs).

## Self-hosted releases

For self-hosted releases, typically a flagged feature will be released in an enabled state. That said, you can release a feature to self-hosted disabled, {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/server/public/model/feature_flags.go#L75" title="it's not unprecedented" >}}.

## Tests

Tests should be written to verify all states of the feature flag. Tests should cover any migrations that may take place in both directions (i.e., from "off" to "on" and from "on" to "off"). Ideally E2E tests should be written before the feature is merged, or at least before the feature flag is removed.

## Examples of feature flags

Some [examples are here](https://github.com/mattermost/mattermost/blob/master/server/public/model/feature_flags.go#L75).

## FAQ

1. What are the expected values for boolean feature flags?
   - Normally ``true`` or ``false``, but this may not always equate to enabled/disabled. A feature flag that introduces three new sorting algorithms can also be written:
       - "selection" (default, the existing strategy in production)
       - "bubble"
       - "quick"

2. Is it possible to use a plugin feature flag such as `PluginIncidentManagement` to "prepackage" a plugin only on Cloud by only setting a plugin version to that flag on Cloud? Can self-hosted customers manually set that flag to install the said plugin?
   - Yes. If you leave the default "" then nothing will happen for self-hosted installations.

3. How do feature flags work on webapp?
   - To add a feature flag that affects frontend, the following is needed:
     1. PR to server code to add the new feature flag.
     2. PR to redux to update the types.
     3. PR to webapp to actually use the feature flag.

4. How do feature flags work on mobile?
   - To add a feature flag that affects mobile, the following is needed:
     1. PR to server code to add the new feature flag.
     2. PR to mobile to update the types and to actually use the feature flag.

5. What is the environment variable to set a feature flag?
   - It is `MM_FEATUREFLAGS_<myflag>`.

6. Can plugins use feature flags to enable small features aside of the version forcing feature flag?
   - Yes. You can create feature flags as if they were added for the core product, and they'll get included in the plugin through the config.


7. Do feature flag changes require the server to be restarted?
   - Feature flags don’t require a server restart unless the feature being flagged requires a restart itself.

8. For features that are requested by self-hosted customers, why do we have to deploy to Cloud first, rather than having the customer who has the test case test it?
    - Cloud is the way to validate the stability of the feature before it goes to self-hosted customers. In exceptional cases we can let the self-hosted customer know that they can use environment variables to enable the feature flag (but specify that the feature is experimental).

9.  How does the current process take into account bugs that may arise on self-hosted specifically?
    - The process hasn’t changed much from the old release process: Features can still be tested on self-hosted servers once they have been rolled out to Cloud. The primary goal is that bugs are first identified on Cloud servers.

10. How can self-hosted installations set feature flags?
    - Self-hosted installations can set environment variables to set feature flag values. However, users should recognize that the feature is still considered "experimental" and should not be enabled on production servers.
