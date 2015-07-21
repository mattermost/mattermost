// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    handleSubmit: function(e) {
        e.preventDefault();

        var state = { server_error: "" };
        var valid = true;

        var name = this.state.name.trim();
        if (!name) {
            state.name_error = "This field is required";
            valid = false;
        } else {
            state.name_error = "";
        }

        this.setState(state);

        if (!valid)
            return;

        if (this.props.teamDisplayName === name)
            return;

        var data = {};
        data["new_name"] = name;

        Client.updateTeamDisplayName(data,
            function(data) {
                $('#rename_team_link').modal('hide');
                window.location.reload();
            }.bind(this),
            function(err) {
                state.server_error = err.message;
                this.setState(state);
            }.bind(this)
        );
    },
    onNameChange: function() {
        this.setState({ name: this.refs.name.getDOMNode().value })
    },
    componentDidMount: function() {
        var self = this;
        $(this.refs.modal.getDOMNode()).on('hidden.bs.modal', function(e) {
            self.setState({ name: self.props.teamDisplayName });
        });
    },
    getInitialState: function() {
        return { name: this.props.teamDisplayName };
    },
    render: function() {

        var name_error = this.state.name_error ? <label className='control-label'>{ this.state.name_error }</label> : null;
        var server_error = this.state.server_error ? <div className='form-group has-error'><label className='control-label'>{ this.state.server_error }</label></div> : null;

        return (
            <div className="modal fade" ref="modal" id="rename_team_link" tabIndex="-1" role="dialog" aria-hidden="true">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <button type="button" className="close" data-dismiss="modal">
                                <span aria-hidden="true">&times;</span>
                                <span className="sr-only">Close</span>
                            </button>
                        <h4 className="modal-title">{"Rename " + utils.toTitleCase(strings.Team)}</h4>
                        </div>
                        <div className="modal-body">
                            <form role="form" onSubmit={this.handleSubmit}>
                                <div className={ this.state.name_error ? "form-group has-error" : "form-group" }>
                                    <label className='control-label'>Name</label>
                                    <input onChange={this.onNameChange} type="text" ref="name" className="form-control" placeholder={"Enter "+strings.Team+" name"} value={this.state.name} maxLength="64" />
                                    { name_error }
                                </div>
                                { server_error }
                            </form>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-default" data-dismiss="modal">Close</button>
                            <button onClick={this.handleSubmit} type="button" className="btn btn-primary">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});

