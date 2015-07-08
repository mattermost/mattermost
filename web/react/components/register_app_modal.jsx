// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var client = require('../utils/client.jsx');

module.exports = React.createClass({
    register: function() {
        var state = this.state;
        state.server_error = null;

        var app = {};

        var name = this.refs.name.getDOMNode().value;
        if (!name || name.length === 0) {
            state.name_error = "Application name must be filled in.";
            this.setState(state);
            return;
        }
        state.name_error = null;
        app.name = name;

        var homepage = this.refs.homepage.getDOMNode().value;
        if (!homepage || homepage.length === 0) {
            state.homepage_error = "Homepage must be filled in.";
            this.setState(state);
            return;
        }
        state.homepage_error = null;
        app.homepage = homepage;

        var desc = this.refs.desc.getDOMNode().value;
        if (!desc || desc.length === 0) {
            state.desc_error = "Please add a short description.";
            this.setState(state);
            return;
        }
        state.desc_error = null;
        app.description = desc;

        var callback = this.refs.callback.getDOMNode().value;
        if (!callback || callback.length === 0) {
            state.callback_error = "Callback URL msut be filled in.";
            this.setState(state);
            return;
        }
        state.callback_error = null;
        app.callback_url = callback;


        client.registerApp(app,
            function(data) {
                this.setState(state);
                console.log(data);
            }.bind(this),
            function(err) {
                state.server_error = err.message;
                this.setState(state);
            }.bind(this)
        );
    },
    getInitialState: function() {
        return { };
    },
    render: function() {
        var name_error = this.state.name_error ? <div className="form-group has-error"><label className="control-label">{ this.state.name_error }</label></div> : null;
        var homepage_error = this.state.homepage_error ? <div className="form-group has-error"><label className="control-label">{ this.state.homepage_error }</label></div> : null;
        var desc_error = this.state.desc_error ? <div className="form-group has-error"><label className="control-label">{ this.state.desc_error }</label></div> : null;
        var callback_error = this.state.callback_error ? <div className="form-group has-error"><label className="control-label">{ this.state.callback_error }</label></div> : null;
        var server_error = this.state.server_error ? <div className="form-group has-error"><label className="control-label">{ this.state.server_error }</label></div> : null;

        return (
        <div className="modal fade" ref="modal" id="register_app" role="dialog" aria-hidden="true">
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                        <h4 className="modal-title" ref="title">Developer Applications</h4>
                    </div>
                    <div className="modal-body">
                        <div className="form-group user-settings">
                            <h3>Register a New Application</h3>
                            <br/>
                            <label className="col-sm-4 control-label">Application Name</label>
                            <div className="col-sm-7">
                                <input ref="name" className="form-control" type="text" />
                                {name_error}
                            </div>
                            <br/>
                            <br/>
                            <label className="col-sm-4 control-label">Homepage URL</label>
                            <div className="col-sm-7">
                                <input ref="homepage" className="form-control" type="text" />
                                {homepage_error}
                            </div>
                            <br/>
                            <br/>
                            <label className="col-sm-4 control-label">Description</label>
                            <div className="col-sm-7">
                                <input ref="desc" className="form-control" type="text" />
                                {desc_error}
                            </div>
                            <br/>
                            <br/>
                            <label className="col-sm-4 control-label">Callback URL</label>
                            <div className="col-sm-7">
                                <input ref="callback" className="form-control" type="text" />
                                {callback_error}
                            </div>
                            <br/>
                            <br/>
                            <br/>
                            <br/>
                            <br/>
                            <a className="btn btn-sm theme pull-right" href="#" data-dismiss="modal" aria-label="Close">Cancel</a>
                            <a className="btn btn-sm btn-primary pull-right" onClick={this.register}>Register</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        );
    }
});

