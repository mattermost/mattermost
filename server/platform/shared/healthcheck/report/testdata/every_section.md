# Health report

- **Generated:** 2026-11-18 09:50 UTC
- **Last evaluated:** 2026-11-18 09:30 UTC
- **Site name:** Example Chat
- **Site URL:** https://chat.example.com
- **Server version:** 12.3.0
- **License:** Enterprise

## Summary

2 critical, 2 warnings, 1 info, 1 could not be evaluated

Also included: 2 muted, 1 resolved.

## Critical

### \[Notifications\] PushNotificationServer does not use https://

PushNotificationServer http://push.example.com uses http://, so push notifications are sent in cleartext.

**How to fix it:** Prefix PushNotificationServer with https:// and verify reachability from the app node.

[Read the documentation](https://docs.mattermost.com/configure/environment-configuration-settings.html#push-notification-server)

### \[Updates\] Mattermost version is past end-of-life

Running Mattermost 11.0.4. Support for this release line ended on 2026-01-15.

**How to fix it:** Plan a staged upgrade to a supported release.

## Warning

### \[Authentication\] AD/LDAP synchronization has not run recently

### \[Platform\] File storage disk space is low on app-1.example.com

The volume containing FileSettings.Directory has 9.0 GiB (9.00%) available of 100.0 GiB.

**How to fix it:** Expand the volume.

## Info

### \[experimental\] A rule in an area this build does not know

Shown under its raw area name. Pasting `@channel` stays inert, and https://example.com/a_b stays linked.

## Could not evaluate

- **Host load is high on app-2.example.com:** Server diagnostics unavailable.

## Muted

- **Site URL is not HTTPS** (Warning): SiteURL http://chat.example.com does not use https://.
- **GOMAXPROCS exceeds the container CPU limit** (Warning)

## Resolved

- Site URL is empty
