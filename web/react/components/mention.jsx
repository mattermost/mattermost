// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.
var UserStore = require("../stores/user_store.jsx");

module.exports = React.createClass({
    handleClick: function() {
        this.props.handleClick(this.props.username);
    },
    select: function() {
        this.setState({ isFocused: "mentions-focus" })
    },
    deselect: function() {
        this.setState({ isFocused: "" });
    },
    getInitialState: function() {
        if (this.props.isFocus) {
            return { isFocused: "mentions-focus" };
        }
        else {
            return { isFocused: "" };
        }
    },
    render: function() {
        var self = this;
        var icon;
        var timestamp = UserStore.getCurrentUser().update_at;
        if (this.props.id === "allmention" || this.props.id === "channelmention") {
            icon = <span><i className="mention-img fa fa-users fa-2x"></i></span>;
        } else if (this.props.id != null) {
            icon = <span><img className="mention-img" src={"/api/v1/users/" + this.props.id + "/image?time=" + timestamp}/></span>;
        } else {
            icon = <span><i className="mention-img fa fa-users fa-2x"></i></span>;
        }
        return (
            <div className={"mentions-name " + this.state.isFocused} id={this.props.id + "_mentions"} onClick={this.handleClick} onMouseEnter={function(){self.props.handleMouseEnter(self.props.listId)}}>
                <div className="pull-left">{icon}</div>
                <div className="pull-left mention-align"><span>@{this.props.username}</span><span className="mention-fullname">{this.props.secondary_text}</span></div>
            </div>
        );
    }
});
