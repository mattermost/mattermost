// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {AnnouncementBarTypes} from 'utils/constants';

import AnnouncementBar from '../default_announcement_bar';

interface Props {
    buildHash?: string;
}

interface State {
    buildHashOnAppLoad?: string;
}

export default class VersionBar extends React.PureComponent <Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            buildHashOnAppLoad: props.buildHash,
        };
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        if (!state.buildHashOnAppLoad && props.buildHash) {
            return {
                buildHashOnAppLoad: props.buildHash,
            };
        }

        return null;
    }

    reloadPage = () => {
        window.location.reload();
    };

    render() {
        const {buildHashOnAppLoad} = this.state;
        const {buildHash} = this.props;

        if (!buildHashOnAppLoad) {
            return null;
        }

        if (buildHashOnAppLoad !== buildHash) {
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
                                onClick={this.reloadPage}
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
        }

        return null;
    }
}
