// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

// TranslationId returns id unchanged. `mmgotool i18n extract` harvests literal arguments to
// calls named TranslationId; public/shared/i18n is not imported to keep this package a pure leaf.
func TranslationId(id string) string { return id }
