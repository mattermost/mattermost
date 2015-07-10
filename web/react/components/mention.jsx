// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.
var UserStore = require("../stores/user_store.jsx");

module.exports = React.createClass({
    handleClick: function() {
        this.props.handleClick(this.props.username);
    },
    handleKeyDown: function(e) {
        var selectedMention = this.state.selectedMention <= nunMentions ? this.state.selectedMention : 1;

        console.log("Here: keyDown");

        if (e.key === "ArrowUp") {
            //selectedMention = selectedMention === numMentions ? 1 : selectedMention++;
            this.props.handleFocus(this.props.listId);
        } 
        else if (e.key === "ArrowDown") {
            //selectedMention = selectedMention === 1 ? numMentions : selectedMention--;
            this.props.handleFocus(this.props.listId);
        }
        else if (e.key === "Enter") {
            this.handleClick();
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
            <div className="mentions-name" ref="mention" onClick={this.handleClick} onKeyDown={this.handleKeyDown}>
                <div className="pull-left">{icon}</div>
                <div className="pull-left mention-align"><span>@{this.props.username}</span><span className="mention-fullname">{this.props.secondary_text}</span></div>
            </div>
        );
    }
});
