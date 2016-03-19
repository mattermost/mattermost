// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';
import GetLinkModal from './get_link_modal.jsx';
import ModalStore from 'stores/modal_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import {intlShape, injectIntl, defineMessages} from 'react-intl';

const holders = defineMessages({
    title: {
        id: 'get_post_link_modal.title',
        defaultMessage: 'Copy Permalink'
    },
    help: {
        id: 'get_post_link_modal.help',
        defaultMessage: 'The link below allows authorized users to see your post.'
    }
});

import React from 'react';

class GetPostLinkModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleToggle = this.handleToggle.bind(this);

        this.hide = this.hide.bind(this);

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
        const {formatMessage} = this.props.intl;

        return (
            <GetLinkModal
                show={this.state.show}
                onHide={this.hide}
                title={formatMessage(holders.title)}
                helpText={formatMessage(holders.help)}
                link={TeamStore.getCurrentTeamUrl() + '/pl/' + this.state.post.id}
            />
        );
    }
}

GetPostLinkModal.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(GetPostLinkModal);
