// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';

import {executeDialogAction} from 'actions/integration_actions';

type Props = {
    label: string;
    url: string;
    context?: Record<string, string>;
};

const AppsFormActionButton: React.FC<Props> = ({label, url, context}) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The dialog containing this button can be closed (unmounting the component)
    // while the action request is still in flight; guard state updates against that.
    const mountedRef = useRef(true);
    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const handleClick = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await dispatch(executeDialogAction(url, context));
            if (!mountedRef.current) {
                return;
            }
            if (result?.error) {
                setError(intl.formatMessage({id: 'interactive_dialog.action_button.error', defaultMessage: 'Action failed'}));
            }
        } catch {
            if (mountedRef.current) {
                setError(intl.formatMessage({id: 'interactive_dialog.action_button.error', defaultMessage: 'Action failed'}));
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [dispatch, url, context, intl]);

    return (
        <div className='form-group'>
            <Button
                onClick={handleClick}
                disabled={loading || !url}
                aria-busy={loading}
                type='button'
            >
                {loading ? intl.formatMessage({id: 'interactive_dialog.action_button.loading', defaultMessage: 'Loading...'}) : label}
            </Button>
            {error && (
                <div
                    className='error-text'
                    role='alert'
                >
                    {error}
                </div>
            )}
        </div>
    );
};

export default AppsFormActionButton;
