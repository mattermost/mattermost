// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {interactiveDialogAppsFormEnabled} from 'mattermost-redux/selectors/entities/interactive_dialog';

import InteractiveDialog from 'components/interactive_dialog';
import type {PropsFromRedux} from 'components/interactive_dialog/index';

import InteractiveDialogAdapter from './interactive_dialog_adapter';

type Props = PropsFromRedux & {
    onExited?: () => void;
};

const DialogRouter: React.FC<Props> = (props) => {
    const isAppsFormEnabled = interactiveDialogAppsFormEnabled(props as any);
    const hasUrl = Boolean(props.url);

    if (isAppsFormEnabled && hasUrl) {
        return <InteractiveDialogAdapter {...props as any}/>;
    }

    return <InteractiveDialog {...props as any}/>;
};

export default DialogRouter;
