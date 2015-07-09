// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var Client =require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var ConfirmModal = require('./confirm_modal.jsx');

module.exports = React.createClass({
    componentDidMount: function() {
        var self = this;
        $('#invite_member').on('hide.bs.modal', function(e) {
            if ($('#invite_member').attr('data-confirm') === 'true') {
                $('#invite_member').attr('data-confirm', 'false');
                return;
            }

            var not_empty = false;
            for (var i = 0; i < self.state.invite_ids.length; i++) {
                var index = self.state.invite_ids[i];
                if (self.refs["email"+index].getDOMNode().value.trim() !== '') {
                    not_empty = true;
                    break;
                }
            }

            if (not_empty) {
                $('#confirm_invite_modal').modal('show');
                e.preventDefault();
            }

        });

        $('#invite_member').on('hidden.bs.modal', function() {
            self.clearFields();
        });
    },
    handleSubmit: function(e) {
        var invite_ids = this.state.invite_ids;
        var count = invite_ids.length;
        var invites = [];
        var email_errors = this.state.email_errors;
        var first_name_errors = this.state.first_name_errors;
        var last_name_errors = this.state.last_name_errors;
        var valid = true;

        for (var i = 0; i < count; i++) {
            var index = invite_ids[i];
            var invite = {};
            invite.email = this.refs["email"+index].getDOMNode().value.trim();
            if (!invite.email || !utils.isEmail(invite.email)) {
                email_errors[index] = "Please enter a valid email address";
                valid = false;
            } else {
                email_errors[index] = "";
            }

            if (config.AllowInviteNames) {
                invite.first_name = this.refs["first_name"+index].getDOMNode().value.trim();
                if (!invite.first_name && config.RequireInviteNames) {
                    first_name_errors[index] = "This is a required field";
                    valid = false;
                } else {
                    first_name_errors[index] = "";
                }

                invite.last_name = this.refs["last_name"+index].getDOMNode().value.trim();
                if (!invite.last_name && config.RequireInviteNames) {
                    last_name_errors[index] = "This is a required field";
                    valid = false;
                } else {
                    last_name_errors[index] = "";
                }
            }

            invites.push(invite);
        }

        this.setState({ email_errors: email_errors, first_name_errors: first_name_errors, last_name_errors: last_name_errors });

        if (!valid || invites.length === 0) return;

        var data = {}
        data["invites"] = invites;

        Client.inviteMembers(data,
            function() {
                $(this.refs.modal.getDOMNode()).attr('data-confirm', 'true');
                $(this.refs.modal.getDOMNode()).modal('hide');
            }.bind(this),
            function(err) {
                if (err.message === "This person is already on your team") {
                    email_errors[err.detailed_error] = err.message;
                    this.setState({ email_errors: email_errors });
                }
                else
                    this.setState({ server_error: err.message});
            }.bind(this)
        );

    },
    componentDidUpdate: function() {
        $(this.refs.modalBody.getDOMNode()).css('max-height', $(window).height() - 200);
        $(this.refs.modalBody.getDOMNode()).css('overflow-y', 'scroll');
    },
    addInviteFields: function() {
        var count = this.state.id_count + 1;
        var invite_ids = this.state.invite_ids;
        invite_ids.push(count);
        this.setState({ invite_ids: invite_ids, id_count: count });
    },
    clearFields: function() {
        var invite_ids = this.state.invite_ids;

        for (var i = 0; i < invite_ids.length; i++) {
            var index = invite_ids[i];
            this.refs["email"+index].getDOMNode().value = "";
            if (config.AllowInviteNames) {
                this.refs["first_name"+index].getDOMNode().value = "";
                this.refs["last_name"+index].getDOMNode().value = "";
            }
        }

        this.setState({
            invite_ids: [0],
            id_count: 0,
            email_errors: {},
            first_name_errors: {},
            last_name_errors: {}
        });
    },
    removeInviteFields: function(index) {
        var count = this.state.id_count;
        var invite_ids = this.state.invite_ids;
        var i = invite_ids.indexOf(index);
        if (i > -1) invite_ids.splice(i, 1);
        if (!invite_ids.length) invite_ids.push(++count);
        this.setState({ invite_ids: invite_ids, id_count: count });
    },
    getInitialState: function() {
        return {
            invite_ids: [0],
            id_count: 0,
            email_errors: {},
            first_name_errors: {},
            last_name_errors: {}
        };
    },
    render: function() {
        var currentUser = UserStore.getCurrentUser()

        if (currentUser != null) {
            var invite_sections = [];
            var invite_ids = this.state.invite_ids;
            var self = this;
            for (var i = 0; i < invite_ids.length; i++) {
                var index = invite_ids[i];
                var email_error = this.state.email_errors[index] ? <label className='control-label'>{ this.state.email_errors[index] }</label> : null;
                var first_name_error = this.state.first_name_errors[index] ? <label className='control-label'>{ this.state.first_name_errors[index] }</label> : null;
                var last_name_error = this.state.last_name_errors[index] ? <label className='control-label'>{ this.state.last_name_errors[index] }</label> : null;

                invite_sections[index] = (
                    <div key={"key" + index}>
                    <div>
                        <button type="button" className="btn btn-link remove__member" onClick={this.removeInviteFields.bind(this, index)}><span className="fa fa-trash"></span></button>
                    </div>
                    <div className={ email_error ? "form-group invite has-error" : "form-group invite" }>
                        <input onKeyUp={this.displayNameKeyUp} type="text" ref={"email"+index} className="form-control" placeholder="email@domain.com" maxLength="64" />
                        { email_error }
                    </div>
                    <div className="row--invite">
                    { config.AllowInviteNames ?
                    <div className="col-sm-6">
                        <div className={ first_name_error ? "form-group has-error" : "form-group" }>
                            <input type="text" className="form-control" ref={"first_name"+index} placeholder="First name" maxLength="64" />
                            { first_name_error }
                        </div>
                    </div>
                    : "" }
                    { config.AllowInviteNames ?
                    <div className="col-sm-6">
                        <div className={ last_name_error ? "form-group has-error" : "form-group" }>
                            <input type="text" className="form-control" ref={"last_name"+index} placeholder="Last name" maxLength="64" />
                            { last_name_error }
                        </div>
                    </div>
                    : "" }
                    </div>
                    </div>
                );
            }

            var server_error = this.state.server_error ? <div className='form-group has-error'><label className='control-label'>{ this.state.server_error }</label></div> : null;

            return (
                <div>
                    <div className="modal fade" ref="modal" id="invite_member" tabIndex="-1" role="dialog" aria-hidden="true">
                       <div className="modal-dialog">
                          <div className="modal-content">
                            <div className="modal-header">
                            <button type="button" className="close" data-dismiss="modal" aria-label="Close" data-reactid=".5.0.0.0.0"><span aria-hidden="true" data-reactid=".5.0.0.0.0.0">×</span></button>
                              <h4 className="modal-title" id="myModalLabel">Invite New Member</h4>
                            </div>
                            <div ref="modalBody" className="modal-body">
                                <form role="form">
                                    { invite_sections }
                                </form>
                                { server_error }
                                <button type="button" className="btn btn-default" onClick={this.addInviteFields}>Add another</button>
                                <br/>
                                <br/>
                                <span>People invited automatically join Town Square channel.</span>
                            </div>
                            <div className="modal-footer">
                              <button type="button" className="btn btn-default" data-dismiss="modal">Close</button>
                              <button onClick={this.handleSubmit} type="button" className="btn btn-primary">Send Invitations</button>
                            </div>
                          </div>
                       </div>
                    </div>
                    <ConfirmModal
                        id="confirm_invite_modal"
                        parent_id="invite_member"
                        title="Discard Invitations?"
                        message="You have unsent invitations, are you sure you want to discard them?"
                        confirm_button="Yes, Discard"
                    />
                </div>
            );
        } else {
            return <div/>;
        }
    }
});
