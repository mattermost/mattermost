// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {LandingPreferenceTypes} from 'utils/constants';

type Props = {
    isMobile: boolean;
    nativeLocation: string;
    setPreference: (preference: string, value: boolean) => void;
    onClick: () => void;
}

const GoNativeAppMessage = ({isMobile, nativeLocation, setPreference, onClick}: Props) => {
    return (
        <a
            href={isMobile ? '#' : nativeLocation}
            onMouseDown={() => {
                setPreference(LandingPreferenceTypes.MATTERMOSTAPP, true);
            }}
            onClick={onClick}
            className='btn btn-primary btn-lg get-app__download'
        >
            {isMobile ? (
                <FormattedMessage
                    id='get_app.systemDialogMessageMobile'
                    defaultMessage='View in App'
                />
            ) : (
                <FormattedMessage
                    id='get_app.systemDialogMessage'
                    defaultMessage='View in Desktop App'
                />
            )}
        </a>
    );
};

export default GoNativeAppMessage;
