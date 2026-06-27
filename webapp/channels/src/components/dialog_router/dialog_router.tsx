// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import InteractiveDialogAdapter from './interactive_dialog_adapter';

import type {PropsFromRedux} from './index';

type OptionalPropsFromRedux = Partial<PropsFromRedux> & Pick<PropsFromRedux, 'emojiMap' | 'hasUrl' | 'actions'>;

type Props = OptionalPropsFromRedux & {
    onExited?: () => void;
};

const DialogRouter: React.FC<Props> = (props) => {
    // Snapshot dialog data at mount — subsequent Redux RECEIVED_DIALOG dispatches
    // for child dialogs won't affect this instance's data
    const [dialogData] = useState(() => props);

    const {hasUrl} = dialogData;

    // URL-less dialog = configuration error
    if (!hasUrl) {
        // eslint-disable-next-line no-console
        console.error('Interactive dialog missing URL - this is a configuration error');
        return null; // Let calling code show ephemeral error
    }

    return <InteractiveDialogAdapter {...dialogData}/>;
};

export default DialogRouter;
