// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

const onClickRefresh = () => {
    location.reload();
};

const TIME_TO_SHOW = 5000;
const TIME_TO_DISMISS = 2000;

type Props = {
    updateWaitForLoader: (v: boolean) => void;
}

const InputLoading = ({
    updateWaitForLoader,
}: Props) => {
    const [showMessage, setShowMessage] = useState(false);

    useEffect(() => {
        let timeout = setTimeout(() => {
            setShowMessage(true);
            updateWaitForLoader(true);
            timeout = setTimeout(() => {
                updateWaitForLoader(false);
            }, TIME_TO_DISMISS);
        }, TIME_TO_SHOW);

        return () => {
            clearTimeout(timeout);
            updateWaitForLoader(false);
        };
    }, []);

    return (
        <div
            className='AdvancedTextEditor__skeleton'
        >
            {showMessage && (
                <>
                    <FormattedMessage
                        id='center_panel.input.cannot_load_component'
                        defaultMessage='Something went wrong while loading the component. Please wait a moment, or try reloading the app.'
                    />
                    <button
                        className='btn btn-tertiary channel-archived__close-btn'
                        onClick={onClickRefresh}
                    >
                        <FormattedMessage
                            id='center_panel.reloadPage'
                            defaultMessage='Reload'
                        />
                    </button>
                </>
            )}
        </div>
    );
};

export default InputLoading;
