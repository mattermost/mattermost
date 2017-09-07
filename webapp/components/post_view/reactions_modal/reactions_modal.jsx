// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import ReactionsUserList from './reactions_user_list.jsx';

import * as Utils from 'utils/utils.jsx';

export default class ReactionsModal extends React.PureComponent {
    static propTypes = {

        /**
         * The post to render reactions for
         */
        post: PropTypes.object.isRequired,

        /**
         * The reactions by name to render
         */
        reactionsByName: PropTypes.object.isRequired,

        /**
         * The reactions to render
         */
        reactions: PropTypes.arrayOf(PropTypes.object).isRequired,

        /*
         * Array of users who reacted to this post
         */
        profiles: PropTypes.array.isRequired,

        /**
         * Array of emoji names
         */
        emojiNames: PropTypes.array.isRequired,

        /**
         * Function called when modal is dismissed
         */
        onModalDismissed: PropTypes.func,
        actions: PropTypes.shape({

            /*
             * Function to get non-loaded profiles by id
             */
            getMissingProfilesByIds: PropTypes.func.isRequired
        })
    }

    constructor(props) {
        super(props);

        this.state = {
            show: true
        };
    }

    componentDidMount() {
        this.loadMissingProfiles();
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextProps, this.props)) {
            return true;
        }

        if (nextState.show !== this.state.show) {
            return true;
        }

        return false;
    }

    handleHide = () => {
        this.setState({show: false});
    }

    handleExit = () => {
        this.props.onModalDismissed();
    }

    loadMissingProfiles = () => {
        const ids = this.props.reactions.map((reaction) => reaction.user_id);
        this.props.actions.getMissingProfilesByIds(ids);
    }

    render() {
        if (!this.props.reactionsByName || this.props.reactionsByName.length === 0) {
            return null;
        }

        return (
            <Modal
                dialogClassName={'more-modal modal-dialog'}
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='reactions_modal.title'
                            defaultMessage='Post Reactions'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <ReactionsUserList
                        post={this.props.post}
                        users={this.props.profiles}
                        reactionsByName={this.props.reactionsByName}
                        emojiNames={this.props.emojiNames}
                        reactions={this.props.reactions}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.handleHide}
                    >
                        <FormattedMessage
                            id='reactions_modal.close'
                            defaultMessage='Close'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
