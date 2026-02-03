// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {AnnouncementBarTypes} from 'utils/constants';

import AnnouncementBar from '../default_announcement_bar';

type Props = {
    buildHash?: string;
}

const reloadPage = () => {
    window.location.reload();
};

const VersionBar = ({
    buildHash,
}: Props) => {
    const [buildHashOnAppLoad, setBuildHashOnAppLoad] = useState<string|undefined>(buildHash);

    useEffect(() => {
        if (!buildHashOnAppLoad && buildHash) {
            setBuildHashOnAppLoad(buildHash);
        }
    }, [buildHash, buildHashOnAppLoad]);

    if (!buildHashOnAppLoad || buildHashOnAppLoad === buildHash) {
        return null;
    }

    if (buildHashOnAppLoad !== buildHash) {
        return (
            <AnnouncementBar
                type={AnnouncementBarTypes.ANNOUNCEMENT}
                message={
                    <>
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
                    </>
                }
            />
        );
    }

    return null;
};

export default React.memo(VersionBar);
