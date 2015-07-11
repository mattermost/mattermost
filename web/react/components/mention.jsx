// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.
var UserStore = require("../stores/user_store.jsx");

module.exports = React.createClass({
    handleClick: function() {
        this.props.handleClick(this.props.username);
    },
    /*handleUp: function(e) {
        var selectedMention = this.state.selectedMention <= nunMentions ? this.state.selectedMention : 1;

        console.log("Here: keyDown");

        if (e.key === "ArrowUp") {
            //selectedMention = selectedMention === numMentions ? 1 : selectedMention++;
            e.preventDefault();
            this.props.handleFocus(this.props.listId);
        } 
        else if (e.key === "ArrowDown") {
            //selectedMention = selectedMention === 1 ? numMentions : selectedMention--;
            e.preventDefault();
            this.props.handleFocus(this.props.listId);
        }
        else if (e.key === "Enter") {
            e.preventDefault();
            this.handleClick();
        }
    },*/
    handleFocus: function() {
        console.log("Entering " + this.props.listId);
        this.setState({ isFocused: "mentions-focus" })
    },
    handleBlur: function() {
        console.log("Leaving " + this.props.listId);
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
        var icon;
        var timestamp = UserStore.getCurrentUser().update_at;
        if (this.props.id != null) {
            icon = <span><img className="mention-img" src={"/api/v1/users/" + this.props.id + "/image?time=" + timestamp}/></span>;
        } else {
            icon = <span><i className="mention-img fa fa-users fa-2x"></i></span>;
        }
        return (
            <div className={"mentions-name " + this.state.isFocused} tabIndex={this.props.id} onClick={this.handleClick} onFocus={this.handleFocus} onBlur={this.handleBlur}>
                <div className="pull-left">{icon}</div>
                <div className="pull-left mention-align"><span>@{this.props.username}</span><span className="mention-fullname">{this.props.secondary_text}</span></div>
            </div>
        );
    }
});
