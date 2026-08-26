# Authoring-tier i18n metadata

`en-with-description.json` pairs every id in `../i18n/en.json` with a
`description` explaining where the string appears and how it is used. The
descriptions are context for translators (human or AI); they are never loaded
by the server.

This directory is deliberately a sibling of `../i18n/` rather than a file
inside it. `server/i18n/` is scanned wholesale: the runtime loader walks it for
locale catalogs, `mmgotool i18n clean-empty` rewrites every file in it through
a struct that has no `description` field, and `build/release.mk` copies it into
the release bundle.

Regenerate after changing translatable strings:

    make i18n-extract-authoring

The generator keeps the ids and `translation` values in lockstep with
`en.json`, preserving existing descriptions. New ids land with an empty
description to fill in.

`make i18n-check` fails if the file is out of date.
