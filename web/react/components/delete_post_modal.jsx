// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var PostStore = require('../stores/post_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var Utils = require('../utils/utils.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

export default class DeletePostModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleDelete = this.handleDelete.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);

        this.state = {title: '', postId: '', channelId: '', selectedList: PostStore.getSelectedPost(), comments: 0};
    }
    handleDelete() {
        Client.deletePost(this.state.channelId, this.state.postId,
            function deleteSuccess() {
                var selectedList = this.state.selectedList;
                if (selectedList && selectedList.order && selectedList.order.length > 0) {
                    var selectedPost = selectedList.posts[selectedList.order[0]];
                    if ((selectedPost.id === this.state.postId && this.state.title === 'Post') || selectedPost.root_id === this.state.postId) {
                        AppDispatcher.handleServerAction({
                            type: ActionTypes.RECIEVED_SEARCH,
                            results: null
                        });

                        AppDispatcher.handleServerAction({
                            type: ActionTypes.RECIEVED_POST_SELECTED,
                            results: null
                        });
                    } else if (selectedPost.id === this.state.postId && this.state.title === 'Comment') {
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
                PostStore.removePost(this.state.postId, this.state.channelId);
                AsyncClient.getPosts(this.state.channelId);
            }.bind(this),
            function deleteFailed(err) {
                AsyncClient.dispatchError(err, 'deletePost');
            }
        );
    }
    componentDidMount() {
        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function freshOpen(e) {
            var newState = {};
            if (BrowserStore.getItem('edit_state_transfer')) {
                newState = BrowserStore.getItem('edit_state_transfer');
                BrowserStore.removeItem('edit_state_transfer');
            } else {
                var button = e.relatedTarget;
                newState = {title: $(button).attr('data-title'), channelId: $(button).attr('data-channelid'), postId: $(button).attr('data-postid'), comments: $(button).attr('data-comments')};
            }
            self.setState(newState);
        });
        PostStore.addSelectedPostChangeListener(this.onListenerChange);
    }
    componentWillUnmount() {
        PostStore.removeSelectedPostChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        var newList = PostStore.getSelectedPost();
        if (!Utils.areStatesEqual(this.state.selectedList, newList)) {
            this.setState({selectedList: newList});
        }
    }
    render() {
        var error = null;
        if (this.state.error) {
            error = <div className='form-group has-error'><label className='control-label'>{this.state.error}</label></div>;
        }

        var commentWarning = '';
        if (this.state.comments > 0) {
            commentWarning = 'This post has ' + this.state.comments + ' comment(s) on it.';
        }

        return (
            <div
                className='modal fade'
                id='delete_post'
                ref='modal'
                role='dialog'
                tabIndex='-1'
                aria-hidden='true'
            >
              <div className='modal-dialog modal-push-down'>
                <div className='modal-content'>
                  <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label='Close'
                    >
                        <span aria-hidden='true'>&times;</span>
                    </button>
                    <h4 className='modal-title'>Confirm {this.state.title} Delete</h4>
                  </div>
                  <div className='modal-body'>
                    Are you sure you want to delete the {this.state.title.toLowerCase()}?
                    <br/>
                    <br/>
                    {commentWarning}
                  </div>
                  {error}
                  <div className='modal-footer'>
                    <button
                        type='button'
                        className='btn btn-default'
                        data-dismiss='modal'
                    >
                        Cancel
                    </button>
                    <button
                        type='button'
                        className='btn btn-danger'
                        data-dismiss='modal'
                        onClick={this.handleDelete}
                    >
                        Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
        );
    }
}
