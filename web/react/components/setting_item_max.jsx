// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

module.exports = React.createClass({
    render: function() {
        var client_error = this.props.client_error ? <div className='form-group'><label className='col-sm-12 has-error'>{ this.props.client_error }</label></div> : null;
        var server_error = this.props.server_error ? <div className='form-group'><label className='col-sm-12 has-error'>{ this.props.server_error }</label></div> : null;

        var inputs = this.props.inputs;

        return (
            <ul className="section-max form-horizontal">
                <li className="col-sm-12 section-title">{this.props.title}</li>
                <li className="col-sm-9 col-sm-offset-3">
                    <ul className="setting-list">
                        <li className="setting-list-item">
                            {inputs}
                        </li>
                        <li className="setting-list-item">
                            <hr />
                            { server_error }
                            { client_error }
                            { this.props.submit ? <a className="btn btn-sm btn-primary" onClick={this.props.submit}>Submit</a> : "" }
                            <a className="btn btn-sm theme" href="#" onClick={this.props.updateSection}>Cancel</a>
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
});
