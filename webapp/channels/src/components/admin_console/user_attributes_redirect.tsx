// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Redirect} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

// Enterprise+ no longer has a dedicated "User Attributes" page -- those
// fields now live in Manage Attributes as non-template fields. This keeps
// the old bookmarked/linked URL working instead of falling through to the
// admin console's unrelated default-page redirect.
const UserAttributesRedirect: React.FC<RouteComponentProps> = ({match}) => (
    <Redirect to={match.url.replace(/user_attributes$/, 'manage_attributes')}/>
);

export default UserAttributesRedirect;
