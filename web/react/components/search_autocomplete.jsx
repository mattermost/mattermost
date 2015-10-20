// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const ChannelStore = require('../stores/channel_store.jsx');
const UserStore = require('../stores/user_store.jsx');
const Utils = require('../utils/utils.jsx');

const patterns = {
    channels: /\b(?:in|channel):\s*(\S*)$/i,
    users: /\bfrom:\s*(\S*)$/i
};

export default class SearchAutocomplete extends React.Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);

        this.state = {
            show: false,
            mode: '',
            filter: ''
        };
    }

    componentDidMount() {
        $(document).on('click', this.handleDocumentClick);
    }

    componentWillUnmount() {
        $(document).off('click', this.handleDocumentClick);
    }

    handleClick(value) {
        this.props.completeWord(this.state.filter, value);

        this.setState({
            show: false,
            mode: '',
            filter: ''
        });
    }

    handleDocumentClick(e) {
        const container = $(ReactDOM.findDOMNode(this.refs.container));

        if (!(container.is(e.target) || container.has(e.target).length > 0)) {
            this.setState({
                show: false
            });
        }
    }

    handleInputChange(textbox, text) {
        const caret = Utils.getCaretPosition(textbox);
        const preText = text.substring(0, caret);

        let mode = '';
        let filter = '';
        for (const pattern in patterns) {
            const result = patterns[pattern].exec(preText);

            if (result) {
                mode = pattern;
                filter = result[1];
                break;
            }
        }

        this.setState({
            mode,
            filter,
            show: mode || filter
        });
    }

    render() {
        if (!this.state.show) {
            return null;
        }

        let suggestions = [];

        if (this.state.mode === 'channels') {
            let channels = ChannelStore.getAll();

            if (this.state.filter) {
                channels = channels.filter((channel) => channel.name.startsWith(this.state.filter));
            }

            suggestions = channels.map((channel) => {
                return (
                    <div
                        key={channel.id}
                        onClick={this.handleClick.bind(this, channel.name)}
                    >
                        {channel.name}
                    </div>
                );
            });
        } else if (this.state.mode === 'users') {
            let users = UserStore.getActiveOnlyProfileList();

            if (this.state.filter) {
                users = users.filter((user) => user.username.startsWith(this.state.filter));
            }

            suggestions = users.map((user) => {
                return (
                    <div
                        key={user.id}
                        onClick={this.handleClick.bind(this, user.username)}
                    >
                        {user.username}
                    </div>
                );
            });
        }

        if (suggestions.length === 0) {
            return null;
        }

        return (
            <div
                ref='container'
                style={{overflow: 'visible', position: 'absolute', zIndex: '100', background: 'yellow'}}
            >
                {suggestions}
            </div>
        );
    }
}

SearchAutocomplete.propTypes = {
    completeWord: React.PropTypes.func.isRequired
};
