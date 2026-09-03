// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {lazy} from 'react';

// Lazy-wrapped so monaco-editor stays out of the main channels bundle; consumers render inside <Suspense>.
export const AccessControlTableEditor = lazy(() => import(/* webpackChunkName: 'access-control-editors' */ 'components/admin_console/access_control/editors/table_editor/table_editor'));
export const AccessControlCELEditor = lazy(() => import(/* webpackChunkName: 'access-control-editors' */ 'components/admin_console/access_control/editors/cel_editor/editor'));
