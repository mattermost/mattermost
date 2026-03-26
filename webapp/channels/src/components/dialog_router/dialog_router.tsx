// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import InteractiveDialogAdapter from './interactive_dialog_adapter';

import type {PropsFromRedux} from './index';

type OptionalPropsFromRedux = Partial<PropsFromRedux> & Pick<PropsFromRedux, 'emojiMap' | 'hasUrl' | 'actions'>;

type Props = OptionalPropsFromRedux & {
    onExited?: () => void;
};

const DialogRouter: React.FC<Props> = (props) => {
    const {hasUrl} = props;

    // URL-less dialog = configuration error
    if (!hasUrl) {
        // eslint-disable-next-line no-console
        console.error('Interactive dialog missing URL - this is a configuration error');
        return null; // Let calling code show ephemeral error
    }

    return <InteractiveDialogAdapter {...props}/>;
};

export default DialogRouter;
