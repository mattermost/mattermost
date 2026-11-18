// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Rule} from 'eslint';

declare const plugin: {rules: Record<string, Rule.RuleModule>};
export default plugin;
