// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, memo} from 'react';
import {FormattedMessage} from 'react-intl';

import {AnnouncementBarTypes} from 'utils/constants';

import AnnouncementBar from '../default_announcement_bar';

const reloadPage = () => {
    window.location.reload();
};

interface Props {
    buildHash?: string;
}

const VersionBar = ({
    buildHash,
}: Props) => {
    const [buildHashOnAppLoad, setBuildHashOnAppLoad] = useState(buildHash);

    useEffect(() => {
        if (!buildHashOnAppLoad && buildHash) {
            setBuildHashOnAppLoad(buildHash);
        }
    }, [buildHash]);

    if (!buildHashOnAppLoad) {
        return null;
    }

    if (buildHashOnAppLoad === buildHash) {
        return null;
    }

    return (
        <AnnouncementBar
            type={AnnouncementBarTypes.ANNOUNCEMENT}
            message={
                <React.Fragment>
                    <FormattedMessage
                        id='version_bar.new'
                        defaultMessage='A new version of Mattermost is available.'
                    />
                    <a
                        onClick={reloadPage}
                        style={{marginLeft: '.5rem'}}
                    >
                        <FormattedMessage
                            id='version_bar.refresh'
                            defaultMessage='Refresh the app now'
                        />
                    </a>
                    {'.'}
                </React.Fragment>
            }
        />
    );
};

export default memo(VersionBar);
