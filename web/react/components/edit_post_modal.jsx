// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var Textbox = require('./textbox.jsx');

module.exports = React.createClass({
    handleEdit: function(e) {
        var updatedPost = {};
        updatedPost.message = this.state.editText.trim();

        if (updatedPost.message.length === 0) {
            var tempState = this.state;
            delete tempState.editText;
            sessionStorage.setItem('edit_state_transfer', JSON.stringify(tempState));
            $("#edit_post").modal('hide');
            $("#delete_post").modal('show');
            return;
        }

        updatedPost.id = this.state.post_id
        updatedPost.channel_id = this.state.channel_id

        Client.updatePost(updatedPost,
            function(data) {
                AsyncClient.getPosts(true, this.state.channel_id);
                window.scrollTo(0, 0);
            }.bind(this),
            function(err) {
                AsyncClient.dispatchError(err, "updatePost");
            }.bind(this)
        );

        $("#edit_post").modal('hide');
    },
    handleEditInput: function(editText) {
        this.setState({ editText: editText });
    },
    handleEditKeyPress: function(e) {
        if (e.which == 13 && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            this.refs.editbox.getDOMNode().blur();
            this.handleEdit(e);
        }
    },
    handleUserInput: function(e) {
        this.setState({ editText: e.target.value });
    },
    componentDidMount: function() {
        var self = this;

        $(this.refs.modal.getDOMNode()).on('hidden.bs.modal', function(e) {
            self.setState({ editText: "", title: "", channel_id: "", post_id: "", comments: 0 });
        });

        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            var button = e.relatedTarget;
            self.setState({ editText: $(button).attr('data-message'), title: $(button).attr('data-title'), channel_id: $(button).attr('data-channelid'), post_id: $(button).attr('data-postid'), comments: $(button).attr('data-comments') });
        });

        $(this.refs.modal.getDOMNode()).on('shown.bs.modal', function(e) {
            self.refs.editbox.resize();
        });
    },
    getInitialState: function() {
        return { editText: "", title: "", post_id: "", channel_id: "", comments: 0 };
    },
    render: function() {
        var error = this.state.error ? <div className='form-group has-error'><label className='control-label'>{ this.state.error }</label></div> : null;

        return (
            <div className="modal fade edit-modal" ref="modal" id="edit_post" role="dialog" aria-hidden="true">
              <div className="modal-dialog modal-push-down">
                <div className="modal-content">
                  <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close" onClick={this.handleEditClose}><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title">Edit {this.state.title}</h4>
                  </div>
                  <div className="edit-modal-body modal-body">
                    <Textbox
                        onUserInput={this.handleEditInput}
                        onKeyPress={this.handleEditKeyPress}
                        messageText={this.state.editText}
                        createMessage="Edit the post..."
                        id="edit_textbox"
                        ref="editbox"
                    />
                    { error }
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-default" data-dismiss="modal">Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={this.handleEdit}>Save</button>
                  </div>
                </div>
              </div>
            </div>
        );
    }
});
