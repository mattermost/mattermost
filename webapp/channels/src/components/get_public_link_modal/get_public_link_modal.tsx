// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GetLinkModal from 'components/get_link_modal';

import * as Utils from 'utils/utils';

import type {PropsFromRedux} from './index';

interface Props extends PropsFromRedux {
    onExited: () => void;
    fileId: string;
}

type State = {
    show: boolean;
}

export default class GetPublicLinkModal extends React.PureComponent<Props, State> {
    public static defaultProps: Partial<Props> = {
        link: '',
    };

    public constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
        };
    }

    public componentDidMount() {
        this.props.actions.getFilePublicLink(this.props.fileId);
    }

    public onHide = () => {
        this.setState({
            show: false,
        });
    };

    public render() {
        return (
            <GetLinkModal
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onExited}
                title={Utils.localizeMessage('get_public_link_modal.title', 'Copy Public Link')}
                helpText={Utils.localizeMessage('get_public_link_modal.help', 'The link below allows anyone to see this file without being registered on this server.')}
                link={this.props.link}
            />
        );
    }
}
