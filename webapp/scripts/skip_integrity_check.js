// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');
const content = JSON.parse(fs.readFileSync('package-lock.json', 'utf-8'));

// Skip integrity check for mmjstool, which differs on Apple Silicon M1.
// @see https://github.com/npm/cli/issues/2846
delete content.dependencies.mmjstool.integrity;
delete content.packages['node_modules/mmjstool'].integrity;
delete content.dependencies.marked.integrity;
delete content.packages['node_modules/marked'].integrity;

fs.writeFileSync('package-lock.json', JSON.stringify(content, null, 2) + '\n');
