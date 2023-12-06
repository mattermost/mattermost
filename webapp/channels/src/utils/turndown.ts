// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {tables} from '@guyplusplus/turndown-plugin-gfm';
import TurndownService from 'turndown';

const turndownService = new TurndownService({emDelimiter: '*'}).remove('style');
turndownService.use(tables);

export default turndownService;
