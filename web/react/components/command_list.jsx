// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var client = require('../utils/client.jsx');
var utils = require('../utils/utils.jsx');

export default class CommandList extends React.Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.addFirstCommand = this.addFirstCommand.bind(this);
        this.isEmpty = this.isEmpty.bind(this);
        this.getSuggestedCommands = this.getSuggestedCommands.bind(this);
        this.getSuggestedWebhooks = utils.debounce(this.getSuggestedWebhooks.bind(this), 500);

        this.state = {
            suggestions: [ ],
            cmd: ''
        };
    }

    handleClick(i) {
        this.props.addCommand(this.state.suggestions[i].suggestion);
        this.setState({suggestions: [ ], cmd: ''});
    }

    addFirstCommand() {
        if (this.state.suggestions.length === 0) {
            return;
        }
        this.handleClick(0);
    }

    isEmpty() {
        return this.state.suggestions.length === 0;
    }

    getSuggestedCommands(cmd) {
        if (!cmd || cmd.charAt(0) !== '/') {
            this.setState({suggestions: [ ], cmd: ''});
            return;
        }

        client.executeCommand(
            this.props.channelId,
            cmd,
            true,
            false,
            function success(data) {
                if (data.suggestions.length === 1 && data.suggestions[0].suggestion === cmd) {
                    data.suggestions = [];
                }
                this.setState({suggestions: data.suggestions, cmd: cmd});
            }.bind(this),
            function fail() {
            }
        );
    }

    getSuggestedWebhooks(cmd) {
        //TODO replace client.listOutgoingHooks with some websocket updated trigger list
        //     to prevent post request on every keystroke
        // var self = this;
        client.listOutgoingHooks(function webhookSuccess(webhooks) {
            var suggestedWebhookTriggers = [];
            webhooks.map((webhook) => {
                suggestedWebhookTriggers = suggestedWebhookTriggers.concat(webhook.trigger_words);
            });

            if (suggestedWebhookTriggers.indexOf(cmd.charAt(0)) === -1) {
                return;
            }

            client.executeCommand(
                this.props.channelId,
                cmd,
                true,
                true,
                function success(data) {
                    if (data.suggestions.length === 1 && data.suggestions[0].suggestion === cmd) {
                        data.suggestions = [];
                    }
                    var suggestions = this.state.suggestions.concat(data.suggestions);
                    this.setState({suggestions: suggestions, cmd: cmd});
                }.bind(this),
                function fail() {
                }
            );
        }.bind(this));
    }

    render() {
        if (this.state.suggestions.length === 0) {
            return (<div/>);
        }

        var suggestions = [];

        for (var i = 0; i < this.state.suggestions.length; i++) {
            if (this.state.suggestions[i].suggestion !== this.state.cmd) {
                suggestions.push(
                    <div
                        key={i}
                        className='command-name'
                        onClick={this.handleClick.bind(this, i)}
                    >
                        <div className='command__title'><strong>{this.state.suggestions[i].suggestion}</strong></div>
                        <div className='command__desc'>{this.state.suggestions[i].description}</div>
                    </div>
                );
            }
        }

        return (
            <div
                ref='mentionlist'
                className='command-box'
                style={{height: (this.state.suggestions.length * 56) + 2}}
            >
                {suggestions}
            </div>
        );
    }
}

CommandList.defaultProps = {
    channelId: null
};

CommandList.propTypes = {
    addCommand: React.PropTypes.func,
    channelId: React.PropTypes.string
};
