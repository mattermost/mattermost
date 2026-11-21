// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The testid grammar is the tool's (`@mattermost/test-surface/grammar`): the lint rules, the scanner and the runtime read
// one file, and the build bundles it, so the published lib does not depend on the tool.
export {
    TEST_ID_ROLES as ROLES,
    keyOf as keyOfTemplate,
    keyOfTestId,
    keyedPattern,
    parseTestId,
    type TestIdRole as Role,
} from '@mattermost/test-surface/grammar';
