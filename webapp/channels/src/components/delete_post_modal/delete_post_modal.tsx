// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';
import {matchPath} from 'react-router-dom';

import type {Post} from '@mattermost/types/posts';

import type {ActionResult} from 'mattermost-redux/types/actions';

import SectionNotice from 'components/section_notice';

import {getHistory} from 'utils/browser_history';
import * as UserAgent from 'utils/user_agent';

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
        deleteAndRemovePost: (post: Post) => Promise<ActionResult<boolean>>;
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
    };

    handleEntered = () => {
        this.deletePostBtn?.current?.focus();
    };

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
    };

    getTitle = () => {
        return this.props.post.root_id ? (
            <FormattedMessage
                id='delete_post.confirm_comment'
                defaultMessage='Confirm Comment Delete'
            />
        ) : (
            <FormattedMessage
                id='delete_post.confirm_post'
                defaultMessage='Confirm Post Delete'
            />
        );
    };

    getPrompt = () => {
        return this.props.post.root_id ? (
            <FormattedMessage
                id='delete_post.question_comment'
                defaultMessage='Are you sure you want to delete this comment?'
                tagName='p'
            />
        ) : (
            <FormattedMessage
                id='delete_post.question_post'
                defaultMessage='Are you sure you want to delete this message?'
                tagName='p'
            />
        );
    };

    render() {
        let commentWarning: React.ReactNode = '';
        let remoteWarning: React.ReactNode = '';

        if (this.props.commentCount > 0 && this.props.post.root_id === '') {
            commentWarning = (
                <FormattedMessage
                    id='delete_post.warning'
                    defaultMessage='This message has {count, number} {count, plural, one {comment} other {comments}} on it.'
                    values={{
                        count: this.props.commentCount,
                    }}
                    tagName='p'
                />
            );
        }

        if (this.props.post.remote_id) {
            remoteWarning = <SharedChannelPostDeleteWarning post={this.props.post}/>;
        }

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onEntered={this.handleEntered}
                onHide={this.onHide}
                onExited={this.props.onExited}
                id='deletePostModal'
                role='none'
                aria-labelledby='deletePostModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='deletePostModalLabel'
                    >
                        {this.getTitle()}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {this.getPrompt()}
                    {commentWarning}
                    {remoteWarning}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-tertiary'
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

const SharedChannelPostDeleteWarning = ({post}: {post: Post}) => {
    const {formatMessage} = useIntl();

    const text = post.root_id ? (
        formatMessage({
            id: 'delete_post.shared_channel_warning.message_comment',
            defaultMessage: 'This comment originated from a shared channel in another workspace. Deleting it here won\'t remove it from the channel in the other workspace.',
        })
    ) : (
        formatMessage({
            id: 'delete_post.shared_channel_warning.message_post',
            defaultMessage: 'This message originated from a shared channel in another workspace. Deleting it here won\'t remove it from the channel in the other workspace.',
        })
    );

    return (
        <SectionNotice
            type='warning'
            title={formatMessage({
                id: 'delete_post.shared_channel_warning.title',
                defaultMessage: 'Shared Channel',
            })}
            text={text}
        />
    );
};
