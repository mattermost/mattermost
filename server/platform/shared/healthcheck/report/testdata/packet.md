# Health report

> Evaluated offline from a Support Packet. The packet is a point-in-time snapshot: findings describe the server when the packet was generated, not its current state.

> The packet has no metadata.yaml.

- **Generated:** 2026-12-18 09:30 UTC
- **Data collected:** 2026-11-18 09:30 UTC
- **Server version:** 12.3.0

## Summary

2 critical, 2 warnings, 1 info, 1 could not be evaluated

## Critical

### \[Notifications\] PushNotificationServer does not use https:// `PUSH_BAD_SCHEME`

PushNotificationServer http://push.example.com uses http://, so push notifications are sent in cleartext.

**How to fix it:** Prefix PushNotificationServer with https:// and verify reachability from the app node.

[Read the documentation](https://docs.mattermost.com/configure/environment-configuration-settings.html#push-notification-server)

### \[Updates\] Mattermost version is past end-of-life `VERSION_EOL`

Running Mattermost 11.0.4. Support for this release line ended on 2026-01-15.

**How to fix it:** Plan a staged upgrade to a supported release.

## Warning

### \[Authentication\] AD/LDAP synchronization has not run recently `LDAP_SYNC_OLD`

### \[Platform\] File storage disk space is low on app-1.example.com `FILESTORE_DISK_LOW`

The volume containing FileSettings.Directory has 9.0 GiB (9.00%) available of 100.0 GiB.

**How to fix it:** Expand the volume.

## Info

### \[experimental\] A rule in an area this build does not know `CUSTOM`

Shown under its raw area name. Pasting `@channel` stays inert, and https://example.com/a_b stays linked.

## Could not evaluate

- **Host load is high on app-2.example.com** `NODE_HOST_LOAD_HIGH` (Info): Server diagnostics unavailable.
