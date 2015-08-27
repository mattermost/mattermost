// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var client = require('../utils/client.jsx');

module.exports = React.createClass({
    getInitialState: function() {
        return { suggestions: [ ], cmd: "" };
    },
    handleClick: function(i) {
        this.props.addCommand(this.state.suggestions[i].suggestion)
        this.setState({ suggestions: [ ], cmd: "" });
    },
    addFirstCommand: function() {
        if (this.state.suggestions.length == 0) return;
        this.handleClick(0);
    },
    isEmpty: function() {
        return this.state.suggestions.length == 0;
    },
    getSuggestedCommands: function(cmd) {

        if (!cmd || cmd.charAt(0) != '/') {
            this.setState({ suggestions: [ ], cmd: "" });
            return;
        }

        client.executeCommand(
            this.props.channelId,
            cmd,
            true,
            function(data) {
                if (data.suggestions.length === 1 && data.suggestions[0].suggestion === cmd) {
                    data.suggestions = [];
                }
                this.setState({ suggestions: data.suggestions, cmd: cmd  });
            }.bind(this),
            function(err){
            }
        );
    },
    render: function() {
        if (this.state.suggestions.length == 0) return (<div/>);

        var suggestions = [];

        for (var i = 0; i < this.state.suggestions.length; i++) {
            if (this.state.suggestions[i].suggestion != this.state.cmd) {
                suggestions.push(
                    <div key={i} className="command-name" onClick={this.handleClick.bind(this, i)}>
                        <div className="command__title"><strong>{ this.state.suggestions[i].suggestion }</strong></div>
                        <div className="command__desc">{ this.state.suggestions[i].description }</div>
                    </div>
                );
            }
        }

        return (
            <div ref="mentionlist" className="command-box" style={{height:(this.state.suggestions.length*56)+2}}>
                { suggestions }
            </div>
        );
    }
});
