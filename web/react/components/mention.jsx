// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

module.exports = React.createClass({
    handleClick: function() {
        this.props.handleClick(this.props.username);
    },
    render: function() {
        return (
            <div className="mentions-name" onClick={this.handleClick}>
                <img className="pull-left mention-img" src={"/api/v1/users/" + this.props.id + "/image"}/>
                <span>@{this.props.username}</span><span style={{'color':'grey', 'marginLeft':'10px'}}>{this.props.name}</span>
            </div>
        );
    }
});
