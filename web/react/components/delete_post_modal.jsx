// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var PostStore = require('../stores/post_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var utils = require('../utils/utils.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

module.exports = React.createClass({
    handleDelete: function(e) {
        Client.deletePost(this.state.channel_id, this.state.post_id,
            function(data) {
                var selected_list = this.state.selectedList;
                if (selected_list && selected_list.order && selected_list.order.length > 0) {
                    var selected_post = selected_list.posts[selected_list.order[0]];
                    if ((selected_post.id === this.state.post_id && this.state.title === "Post") || selected_post.root_id === this.state.post_id) {
                        AppDispatcher.handleServerAction({
                            type: ActionTypes.RECIEVED_SEARCH,
                            results: null
                        });

                        AppDispatcher.handleServerAction({
                            type: ActionTypes.RECIEVED_POST_SELECTED,
                            results: null
                        });
                    } else if (selected_post.id === this.state.post_id && this.state.title === "Comment") {
                        if (selected_post.root_id && selected_post.root_id.length > 0 && selected_list.posts[selected_post.root_id]) {
                            selected_list.order = [selected_post.root_id];
                            delete selected_list.posts[selected_post.id];

                            AppDispatcher.handleServerAction({
                                type: ActionTypes.RECIEVED_POST_SELECTED,
                                post_list: selected_list
                            });

                            AppDispatcher.handleServerAction({
                                type: ActionTypes.RECIEVED_SEARCH,
                                results: null
                            });
                        }
                    }
                }
                AsyncClient.getPosts(true, this.state.channel_id);
            }.bind(this),
            function(err) {
                AsyncClient.dispatchError(err, "deletePost");
            }.bind(this)
        );
    },
    componentDidMount: function() {
        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            var newState = {};
            if(BrowserStore.getItem('edit_state_transfer')) {
                newState = BrowserStore.getItem('edit_state_transfer');
                BrowserStore.removeItem('edit_state_transfer');
            } else {
                var button = e.relatedTarget;
                newState = { title: $(button).attr('data-title'), channel_id: $(button).attr('data-channelid'), post_id: $(button).attr('data-postid'), comments: $(button).attr('data-comments') };
            }
            self.setState(newState);
        });
        PostStore.addSelectedPostChangeListener(this._onChange);
    },
    componentWillUnmount: function() {
        PostStore.removeSelectedPostChangeListener(this._onChange);
    },
    _onChange: function() {
        var newList = PostStore.getSelectedPost();
        if (!utils.areStatesEqual(this.state.selectedList, newList)) {
            this.setState({ selectedList: newList });
        }
    },
    getInitialState: function() {
        return { title: "", post_id: "", channel_id: "", selectedList: PostStore.getSelectedPost(), comments: 0 };
    },
    render: function() {
        var error = this.state.error ? <div className='form-group has-error'><label className='control-label'>{ this.state.error }</label></div> : null;

        return (
            <div className="modal fade" id="delete_post" ref="modal" role="dialog" aria-hidden="true">
              <div className="modal-dialog modal-push-down">
                <div className="modal-content">
                  <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title">Confirm {this.state.title} Delete</h4>
                  </div>
                  <div className="modal-body">
                    Are you sure you want to delete the {this.state.title.toLowerCase()}?
                    <br/>
                    <br/>
                    { this.state.comments > 0 ?
                        "This post has " + this.state.comments + " comment(s) on it."
                    : "" }
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-default" data-dismiss="modal">Close</button>
                    <button type="button" className="btn btn-danger" data-dismiss="modal" onClick={this.handleDelete}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
        );
    }
});
