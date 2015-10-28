// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const ChannelStore = require('../stores/channel_store.jsx');
const KeyCodes = require('../utils/constants.jsx').KeyCodes;
const UserStore = require('../stores/user_store.jsx');
const Utils = require('../utils/utils.jsx');

const patterns = new Map([
    ['channels', /\b(?:in|channel):\s*(\S*)$/i],
    ['users', /\bfrom:\s*(\S*)$/i]
]);
const Popover = ReactBootstrap.Popover;

export default class SearchAutocomplete extends React.Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

        this.completeWord = this.completeWord.bind(this);
        this.updateSuggestions = this.updateSuggestions.bind(this);

        this.state = {
            show: false,
            mode: '',
            filter: '',
            selection: 0,
            suggestions: new Map()
        };
    }

    componentDidMount() {
        $(document).on('click', this.handleDocumentClick);
    }

    componentDidUpdate() {
        $(ReactDOM.findDOMNode(this.refs.searchPopover)).find('.popover-content').perfectScrollbar();
        $(ReactDOM.findDOMNode(this.refs.searchPopover)).find('.popover-content').css('max-height', $(window).height() - 200);
    }

    componentWillUnmount() {
        $(document).off('click', this.handleDocumentClick);
    }

    handleClick(value) {
        this.completeWord(value);
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
        for (const [modeForPattern, pattern] of patterns) {
            const result = pattern.exec(preText);

            if (result) {
                mode = modeForPattern;
                filter = result[1];
                break;
            }
        }

        if (mode !== this.state.mode || filter !== this.state.filter) {
            this.updateSuggestions(mode, filter);
        }

        this.setState({
            mode,
            filter,
            show: mode || filter
        });
    }

    handleKeyDown(e) {
        if (!this.state.show || this.state.suggestions.length === 0) {
            return;
        }

        if (e.which === KeyCodes.UP || e.which === KeyCodes.DOWN) {
            e.preventDefault();

            let selection = this.state.selection;

            if (e.which === KeyCodes.UP) {
                selection -= 1;
            } else {
                selection += 1;
            }

            if (selection >= 0 && selection < this.state.suggestions.length) {
                this.setState({
                    selection
                });
            }
        } else if (e.which === KeyCodes.ENTER || e.which === KeyCodes.SPACE) {
            e.preventDefault();

            this.completeSelectedWord();
        }
    }

    completeSelectedWord() {
        if (this.state.mode === 'channels') {
            this.completeWord(this.state.suggestions[this.state.selection].name);
        } else if (this.state.mode === 'users') {
            this.completeWord(this.state.suggestions[this.state.selection].username);
        }
    }

    completeWord(value) {
        // add a space so that anything else typed doesn't interfere with the search flag
        this.props.completeWord(this.state.filter, value + ' ');

        this.setState({
            show: false,
            mode: '',
            filter: '',
            selection: 0
        });
    }

    updateSuggestions(mode, filter) {
        let suggestions = [];

        if (mode === 'channels') {
            let channels = ChannelStore.getAll();

            if (filter) {
                channels = channels.filter((channel) => channel.name.startsWith(filter));
            }

            channels.sort((a, b) => a.name.localeCompare(b.name));

            suggestions = channels;
        } else if (mode === 'users') {
            let users = UserStore.getActiveOnlyProfileList();

            if (filter) {
                users = users.filter((user) => user.username.startsWith(filter));
            }

            users.sort((a, b) => a.username.localeCompare(b.username));

            suggestions = users;
        }

        let selection = this.state.selection;

        // keep the same user/channel selected if it's still visible as a suggestion
        if (selection > 0 && this.state.suggestions.length > 0) {
            // we can't just use indexOf to find if the selection is still in the list since they are different javascript objects
            const currentSelectionId = this.state.suggestions[selection].id;
            let found = false;

            for (let i = 0; i < suggestions.length; i++) {
                if (suggestions[i].id === currentSelectionId) {
                    selection = i;
                    found = true;

                    break;
                }
            }

            if (!found) {
                selection = 0;
            }
        } else {
            selection = 0;
        }

        this.setState({
            suggestions,
            selection
        });
    }

    render() {
        if (!this.state.show || this.state.suggestions.length === 0) {
            return null;
        }

        let suggestions = [];

        if (this.state.mode === 'channels') {
            suggestions = this.state.suggestions.map((channel, index) => {
                let className = 'search-autocomplete__item';
                if (this.state.selection === index) {
                    className += ' selected';
                }

                return (
                    <div
                        key={channel.name}
                        ref={channel.name}
                        onClick={this.handleClick.bind(this, channel.name)}
                        className={className}
                    >
                        {channel.name}
                    </div>
                );
            });
        } else if (this.state.mode === 'users') {
            suggestions = this.state.suggestions.map((user, index) => {
                let className = 'search-autocomplete__item';
                if (this.state.selection === index) {
                    className += ' selected';
                }

                return (
                    <div
                        key={user.username}
                        ref={user.username}
                        onClick={this.handleClick.bind(this, user.username)}
                        className={className}
                    >
                        <img
                            className='profile-img rounded'
                            src={'/api/v1/users/' + user.id + '/image?time=' + user.update_at}
                        />
                        {user.username}
                    </div>
                );
            });
        }

        return (
            <Popover
                ref='searchPopover'
                onShow={this.componentDidMount}
                id='search-autocomplete__popover'
                className='search-help-popover autocomplete visible'
                placement='bottom'
            >
                {suggestions}
            </Popover>
        );
    }
}

SearchAutocomplete.propTypes = {
    completeWord: React.PropTypes.func.isRequired
};
