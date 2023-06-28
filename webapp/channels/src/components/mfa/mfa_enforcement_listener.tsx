// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';

import {ServerError} from '@mattermost/types/errors';

import {REQUEST_ERROR} from 'mattermost-redux/actions/helpers';
import EventEmitter from 'mattermost-redux/utils/event_emitter';

import {getHistory} from 'utils/browser_history';

export default function MfaEnforcementListener() {
    const location = useLocation();
    const isMfaPage = location.pathname === '/mfa/setup';

    useEffect(() => {
        if (isMfaPage) {
            return () => {};
        }

        const mfaErrorHandler = ({error}: {error: ServerError}) => {
            if (error.status_code !== 403 || error.server_error_id !== 'api.context.mfa_required.app_error') {
                return;
            }

            getHistory().push('/mfa/setup');
        };

        EventEmitter.addListener(REQUEST_ERROR, mfaErrorHandler);

        return () => {
            EventEmitter.removeListener(REQUEST_ERROR, mfaErrorHandler);
        };
    }, [isMfaPage]);

    return null;
}
