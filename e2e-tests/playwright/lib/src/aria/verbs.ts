// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The action verbs, as data, are the tool's (`@mattermost/test-surface/verbs`): the spec lint rules read the same file,
// and the build bundles it, so the published lib does not depend on the tool. The scanner never reads it: it records no
// behaviour, so there is no verb -> events table.
export {
    OBSERVING_VERBS,
    PREPARING_VERBS,
    RETRYING_MATCHERS,
    VERBS,
    type SettleVerb,
    type Verb,
} from '@mattermost/test-surface/verbs';
