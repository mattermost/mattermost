// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import GetLinkModal from './get_link_modal.jsx';
import ModalStore from 'stores/modal_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

export default class GetPostLinkModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleToggle = this.handleToggle.bind(this);
        this.hide = this.hide.bind(this);

        this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);

        this.state = {
            show: false,
            post: {}
        };
    }

    componentDidMount() {
        ModalStore.addModalListener(Constants.ActionTypes.TOGGLE_GET_POST_LINK_MODAL, this.handleToggle);
    }

    componentWillUnmount() {
        ModalStore.removeModalListener(Constants.ActionTypes.TOGGLE_GET_POST_LINK_MODAL, this.handleToggle);
    }

    handleToggle(value, args) {
        this.setState({
            show: value,
            post: args.post
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
                title={Utils.localizeMessage('get_post_link_modal.title', 'Copy Permalink')}
                helpText={Utils.localizeMessage('get_post_link_modal.help', 'The link below allows authorized users to see your post.')}
                link={TeamStore.getCurrentTeamUrl() + '/pl/' + this.state.post.id}
            />
        );
    }
}
