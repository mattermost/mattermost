// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {createPost} from 'actions/post_actions.jsx';

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';

export default class FailedPostOptions extends React.Component {
    static propTypes = {

        /*
         * The failed post
         */
        post: PropTypes.object.isRequired,
        actions: PropTypes.shape({

            /**
             * The function to delete the post
             */
            removePost: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.retryPost = this.retryPost.bind(this);
        this.cancelPost = this.cancelPost.bind(this);

        this.submitting = false;

        this.state = {};
    }

    retryPost(e) {
        e.preventDefault();

        if (this.submitting) {
            return;
        }

        this.submitting = true;

        const post = {...this.props.post};
        Reflect.deleteProperty(post, 'id');
        createPost(post,
            () => {
                this.submitting = false;
            },
            (err) => {
                if (err.id === 'api.post.create_post.root_id.app_error') {
                    this.showPostDeletedModal();
                } else {
                    this.forceUpdate();
                }

                this.submitting = false;
            }
        );
    }

    cancelPost(e) {
        e.preventDefault();
        this.props.actions.removePost(this.props.post);
    }

    render() {
        return (<span className='pending-post-actions'>
            <a
                className='post-retry'
                href='#'
                onClick={this.retryPost}
            >
                <FormattedMessage
                    id='pending_post_actions.retry'
                    defaultMessage='Retry'
                />
            </a>
            {' - '}
            <a
                className='post-cancel'
                href='#'
                onClick={this.cancelPost}
            >
                <FormattedMessage
                    id='pending_post_actions.cancel'
                    defaultMessage='Cancel'
                />
            </a>
        </span>);
    }
}
