// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useSelector} from 'react-redux';

import {interactiveDialogAppsFormEnabled} from 'mattermost-redux/selectors/entities/interactive_dialog';

import type {PropsFromRedux} from 'components/interactive_dialog/index';
import InteractiveDialog from 'components/interactive_dialog/interactive_dialog';

import type {GlobalState} from 'types/store';

import InteractiveDialogAdapter from './interactive_dialog_adapter';

type Props = PropsFromRedux & {
    onExited?: () => void;
};

const DialogRouter: React.FC<Props> = (props) => {
    const isAppsFormEnabled = useSelector((state: GlobalState) => interactiveDialogAppsFormEnabled(state));
    const hasUrl = Boolean(props.url);

    const Component = useMemo(() => {
        return (isAppsFormEnabled && hasUrl) ? InteractiveDialogAdapter : InteractiveDialog;
    }, [isAppsFormEnabled, hasUrl]);

    return <Component {...props}/>;
};

export default DialogRouter;
