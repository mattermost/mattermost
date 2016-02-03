// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../utils/client.jsx';
import PostStore from '../stores/post_store.jsx';
import ModalStore from '../stores/modal_store.jsx';
var Modal = ReactBootstrap.Modal;
import * as Utils from '../utils/utils.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';

import {FormattedMessage} from 'mm-intl';

var ActionTypes = Constants.ActionTypes;

export default class DeletePostModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleDelete = this.handleDelete.bind(this);
        this.handleToggle = this.handleToggle.bind(this);
        this.handleHide = this.handleHide.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);

        this.selectedList = null;

        this.state = {
            show: false,
            post: null,
            commentCount: 0,
            error: ''
        };
    }

    componentDidMount() {
        ModalStore.addModalListener(ActionTypes.TOGGLE_DELETE_POST_MODAL, this.handleToggle);
        PostStore.addSelectedPostChangeListener(this.onListenerChange);
    }

    componentWillUnmount() {
        PostStore.removeSelectedPostChangeListener(this.onListenerChange);
        ModalStore.removeModalListener(ActionTypes.TOGGLE_DELETE_POST_MODAL, this.handleToggle);
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.show && !prevState.show) {
            setTimeout(() => {
                $(ReactDOM.findDOMNode(this.refs.deletePostBtn)).focus();
            }, 0);
        }
    }

    handleDelete() {
        Client.deletePost(
            this.state.post.channel_id,
            this.state.post.id,
            () => {
                var selectedList = this.selectedList;

                if (selectedList && selectedList.order && selectedList.order.length > 0) {
                    var selectedPost = selectedList.posts[selectedList.order[0]];
                    if ((selectedPost.id === this.state.post.id && !this.state.root_id) || selectedPost.root_id === this.state.post.id) {
                        AppDispatcher.handleServerAction({
                            type: ActionTypes.RECIEVED_SEARCH,
                            results: null
                        });

                        AppDispatcher.handleServerAction({
                            type: ActionTypes.RECIEVED_POST_SELECTED,
                            results: null
                        });
                    } else if (selectedPost.id === this.state.post.id && this.state.root_id) {
                        if (selectedPost.root_id && selectedPost.root_id.length > 0 && selectedList.posts[selectedPost.root_id]) {
                            selectedList.order = [selectedPost.root_id];
                            delete selectedList.posts[selectedPost.id];

                            AppDispatcher.handleServerAction({
                                type: ActionTypes.RECIEVED_POST_SELECTED,
                                post_list: selectedList
                            });

                            AppDispatcher.handleServerAction({
                                type: ActionTypes.RECIEVED_SEARCH,
                                results: null
                            });
                        }
                    }
                }

                PostStore.removePost(this.state.post.id, this.state.post.channel_id);
                AsyncClient.getPosts(this.state.post.channel_id);
            },
            (err) => {
                AsyncClient.dispatchError(err, 'deletePost');
            }
        );

        this.handleHide();
    }

    handleToggle(value, args) {
        this.setState({
            show: value,
            post: args.post,
            commentCount: args.commentCount,
            error: ''
        });
    }

    handleHide() {
        this.setState({show: false});
    }

    onListenerChange() {
        var newList = PostStore.getSelectedPost();
        if (!Utils.areObjectsEqual(this.selectedList, newList)) {
            this.selectedList = newList;
        }
    }

    render() {
        if (!this.state.post) {
            return null;
        }

        var error = null;
        if (this.state.error) {
            error = <div className='form-group has-error'><label className='control-label'>{this.state.error}</label></div>;
        }

        var commentWarning = '';
        if (this.state.commentCount > 0) {
            commentWarning = (
                <FormattedMessage
                    id='delete_post.warning'
                    defaultMessage='This post has {count} comment(s) on it.'
                    values={{
                        count: this.state.commentCount
                    }}
                />
            );
        }

        const postTerm = this.state.post.root_id ? (
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
                show={this.state.show}
                onHide={this.handleHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='delete_post.confirm'
                            defaultMessage='Confirm {term} Delete'
                            values={{
                                term: (postTerm)
                            }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <FormattedMessage
                        id='delete_post.question'
                        defaultMessage='Are you sure you want to delete this ${term}?'
                        values={{
                            term: (postTerm)
                        }}
                    />
                    <br />
                    <br />
                    {commentWarning}
                    {error}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.handleHide}
                    >
                        <FormattedMessage
                            id='delete_post.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        ref='deletePostBtn'
                        type='button'
                        className='btn btn-danger'
                        onClick={this.handleDelete}
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
