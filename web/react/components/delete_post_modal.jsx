// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var PostStore = require('../stores/post_store.jsx');
var ModalStore = require('../stores/modal_store.jsx');
var Modal = ReactBootstrap.Modal;
var Utils = require('../utils/utils.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Constants = require('../utils/constants.jsx');
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
            show: true,
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
            commentWarning = 'This post has ' + this.state.commentCount + ' comment(s) on it.';
        }

        const postTerm = Utils.getPostTerm(this.state.post);

        return (
            <Modal
                show={this.state.show}
                onHide={this.handleHide}
            >
                <Modal.Header closeButton={true}>
                    {`Confirm ${postTerm} Delete`}
                </Modal.Header>
                <Modal.Body>
                    {`Are you sure you want to delete this ${postTerm.toLowerCase()}?`}
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
                        {'Cancel'}
                    </button>
                    <button
                        type='button'
                        className='btn btn-danger'
                        onClick={this.handleDelete}
                    >
                        {'Delete'}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }

    static show(post, commentCount) {
        AppDispatcher.handleViewAction({
            type: ActionTypes.TOGGLE_DELETE_POST_MODAL,
            value: true,
            post,
            commentCount: commentCount || 0
        });
    }
}
