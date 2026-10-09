// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Redirect} from 'react-router-dom';

export const RedirectToSiteHealth = () => <Redirect to='/admin_console/reporting/site_health'/>;

export const RedirectToWorkspaceOptimization = () => <Redirect to='/admin_console/reporting/workspace_optimization'/>;
