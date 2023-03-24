// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {matchPath} from 'react-router-dom';

import {Post} from '@mattermost/types/posts';

import * as UserAgent from 'utils/user_agent';
import {getHistory} from 'utils/browser_history';

const urlFormatForDMGMPermalink = '/:teamName/messages/:username/:postid';
const urlFormatForChannelPermalink = '/:teamName/channels/:channelname/:postid';

type Props = {
    channelName?: string;
    teamName?: string;
    post: Post;
    commentCount: number;
    isRHS: boolean;
    onExited: () => void;
    actions: {
        deleteAndRemovePost: (post: Post) => Promise<{data: boolean}>;
    };
    location: {
        pathname: string;
    };
}

type State = {
    show: boolean;
}

export default class DeletePostModal extends React.PureComponent<Props, State> {
    deletePostBtn: React.RefObject<HTMLButtonElement>;

    constructor(props: Props) {
        super(props);
        this.deletePostBtn = React.createRef();

        this.state = {
            show: true,
        };
    }

    handleDelete = async () => {
        const {
            actions,
            post,
        } = this.props;

        let permalinkPostId = '';

        const result = await actions.deleteAndRemovePost(post);

        const matchUrlForDMGM = matchPath<{postid: string}>(this.props.location.pathname, {
            path: urlFormatForDMGMPermalink,
        });

        const matchUrlForChannel = matchPath<{postid: string}>(this.props.location.pathname, {
            path: urlFormatForChannelPermalink,
        });

        if (matchUrlForDMGM) {
            permalinkPostId = matchUrlForDMGM.params.postid;
        } else if (matchUrlForChannel) {
            permalinkPostId = matchUrlForChannel.params.postid;
        }

        if (permalinkPostId === post.id) {
            const channelUrl = this.props.location.pathname.split('/').slice(0, -1).join('/');
            getHistory().replace(channelUrl);
        }

        if (result.data) {
            this.onHide();
        }
    }

    handleEntered = () => {
        this.deletePostBtn?.current?.focus();
    }

    onHide = () => {
        this.setState({show: false});

        if (!UserAgent.isMobile()) {
            let element;
            if (this.props.isRHS) {
                element = document.getElementById('reply_textbox');
            } else {
                element = document.getElementById('post_textbox');
            }
            if (element) {
                element.focus();
            }
        }
    }

    render() {
        let commentWarning: React.ReactNode = '';

        if (this.props.commentCount > 0 && this.props.post.root_id === '') {
            commentWarning = (
                <FormattedMessage
                    id='delete_post.warning'
                    defaultMessage='This post has {count, number} {count, plural, one {comment} other {comments}} on it.'
                    values={{
                        count: this.props.commentCount,
                    }}
                />
            );
        }

        const postTerm = this.props.post.root_id ? (
            <FormattedMessage
                id='delete_post.comment'
                defaultMessage='Comment'
            />
        ) : (
            <FormattedMessage
                id='delete_post.post'
                defaultMessage='Post'
            />
        );

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onEntered={this.handleEntered}
                onHide={this.onHide}
                onExited={this.props.onExited}
                enforceFocus={false}
                id='deletePostModal'
                role='dialog'
                aria-labelledby='deletePostModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='deletePostModalLabel'
                    >
                        <FormattedMessage
                            id='delete_post.confirm'
                            defaultMessage='Confirm {term} Delete'
                            values={{
                                term: (postTerm),
                            }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <FormattedMessage
                        id='delete_post.question'
                        defaultMessage='Are you sure you want to delete this {term}?'
                        values={{
                            term: (postTerm),
                        }}
                    />
                    <br/>
                    <br/>
                    {commentWarning}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-link'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='delete_post.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        ref={this.deletePostBtn}
                        type='button'
                        autoFocus={true}
                        className='btn btn-danger'
                        onClick={this.handleDelete}
                        id='deletePostModalButton'
                    >
                        <FormattedMessage
                            id='delete_post.del'
                            defaultMessage='Delete'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
