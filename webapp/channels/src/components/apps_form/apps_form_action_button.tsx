// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/compass-ui/components/button';

import {executeDialogAction} from 'actions/integration_actions';

import Markdown from 'components/markdown';

import './apps_form_action_button.scss';

type Props = {
    name: string;
    label: string;
    description?: string;
    url: string;
    context?: Record<string, string>;
    channelId?: string;
};

const AppsFormActionButton: React.FC<Props> = ({name, label, description, url, context, channelId}) => {
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
            const result = await dispatch(executeDialogAction(url, context, channelId));
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
    }, [dispatch, url, context, channelId, intl]);

    // Several action buttons can share a label (e.g. one "Schedule" per row), so the
    // description is linked to the button to tell them apart for screen readers.
    const descriptionId = description ? `${name}_description` : undefined;

    const button = (
        <Button
            onClick={handleClick}
            disabled={loading || !url}
            aria-busy={loading}
            aria-describedby={descriptionId}
            type='button'
        >
            {loading ? intl.formatMessage({id: 'interactive_dialog.action_button.loading', defaultMessage: 'Loading...'}) : label}
        </Button>
    );

    return (
        <div className='form-group'>
            {description ? (
                <div className='apps-form-action-button'>
                    <div
                        id={descriptionId}
                        className='apps-form-action-button__description'
                    >
                        <Markdown message={description}/>
                    </div>
                    {button}
                </div>
            ) : button}
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
