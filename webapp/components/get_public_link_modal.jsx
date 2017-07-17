// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {getPublicLink} from 'actions/file_actions.jsx';
import Constants from 'utils/constants.jsx';
import ModalStore from 'stores/modal_store.jsx';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import * as Utils from 'utils/utils.jsx';

import GetLinkModal from './get_link_modal.jsx';

export default class GetPublicLinkModal extends React.Component {
    constructor(props) {
        super(props);

        this.handlePublicLink = this.handlePublicLink.bind(this);
        this.handleToggle = this.handleToggle.bind(this);
        this.hide = this.hide.bind(this);

        this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);

        this.state = {
            show: false,
            fileId: '',
            link: ''
        };
    }

    componentDidMount() {
        ModalStore.addModalListener(Constants.ActionTypes.TOGGLE_GET_PUBLIC_LINK_MODAL, this.handleToggle);
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.show && !prevState.show) {
            getPublicLink(this.state.fileId, this.handlePublicLink);
        }
    }

    componentWillUnmount() {
        ModalStore.removeModalListener(Constants.ActionTypes.TOGGLE_GET_PUBLIC_LINK_MODAL, this.handleToggle);
    }

    handlePublicLink(link) {
        this.setState({
            link
        });
    }

    handleToggle(value, args) {
        this.setState({
            show: value,
            fileId: args.fileId,
            link: ''
        });
    }

    hide() {
        this.setState({
            show: false
        });
    }

    render() {
        return (
            <GetLinkModal
                show={this.state.show}
                onHide={this.hide}
                title={Utils.localizeMessage('get_public_link_modal.title', 'Copy Public Link')}
                helpText={Utils.localizeMessage('get_public_link_modal.help', 'The link below allows anyone to see this file without being registered on this server.')}
                link={this.state.link}
            />
        );
    }
}
