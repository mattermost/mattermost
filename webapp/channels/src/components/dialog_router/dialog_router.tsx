// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useSelector} from 'react-redux';

import {interactiveDialogAppsFormEnabled} from 'mattermost-redux/selectors/entities/interactive_dialog';

import type {GlobalState} from 'types/store';

type Props = Record<string, any>;

const DialogRouter: React.FC<Props> = (props) => {
    const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
    const [loading, setLoading] = useState(true);
    
    const isAppsFormEnabled = useSelector((state: GlobalState) => interactiveDialogAppsFormEnabled(state));
    const hasUrl = Boolean(props.url);

    useEffect(() => {
        const loadComponent = async () => {
            setLoading(true);
            
            if (isAppsFormEnabled && hasUrl) {
                // Use AppsForm-based adapter for dialogs with URLs when feature flag is enabled
                const {default: InteractiveDialogAdapter} = await import('./interactive_dialog_adapter');
                setComponent(() => InteractiveDialogAdapter);
            } else {
                // Use legacy InteractiveDialog for all other cases
                const {default: InteractiveDialog} = await import('components/interactive_dialog/interactive_dialog');
                setComponent(() => InteractiveDialog);
            }
            
            setLoading(false);
        };

        loadComponent();
    }, [isAppsFormEnabled, hasUrl]);

    if (loading || !Component) {
        return null; // Could add a loading spinner here if needed
    }

    return <Component {...props} />;
};

export default DialogRouter;