// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const ChannelStore = require('../stores/channel_store.jsx');
const KeyCodes = require('../utils/constants.jsx').KeyCodes;
const Popover = ReactBootstrap.Popover;
const UserStore = require('../stores/user_store.jsx');
const Utils = require('../utils/utils.jsx');
const Constants = require('../utils/constants.jsx');

const patterns = new Map([
    ['channels', /\b(?:in|channel):\s*(\S*)$/i],
    ['users', /\bfrom:\s*(\S*)$/i]
]);

export default class SearchAutocomplete extends React.Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

        this.completeWord = this.completeWord.bind(this);
        this.getSelection = this.getSelection.bind(this);
        this.scrollToItem = this.scrollToItem.bind(this);
        this.updateSuggestions = this.updateSuggestions.bind(this);

        this.renderChannelSuggestion = this.renderChannelSuggestion.bind(this);
        this.renderUserSuggestion = this.renderUserSuggestion.bind(this);

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

    componentDidUpdate(prevProps, prevState) {
        const content = $(ReactDOM.findDOMNode(this.refs.searchPopover)).find('.popover-content');

        if (this.state.show) {
            if (!prevState.show) {
                content.perfectScrollbar();
                content.css('max-height', $(window).height() - 200);
            }

            // keep the keyboard selection visible when scrolling
            this.scrollToItem(this.getSelection());
        }
    }

    componentWillUnmount() {
        $(document).off('click', this.handleDocumentClick);
    }

    handleClick(value) {
        this.completeWord(value);
    }

    handleDocumentClick(e) {
        const container = $(ReactDOM.findDOMNode(this.refs.searchPopover));

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

            this.completeWord(this.getSelection());
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

    getSelection() {
        if (this.state.mode === 'channels') {
            return this.state.suggestions[this.state.selection].name;
        } else if (this.state.mode === 'users') {
            return this.state.suggestions[this.state.selection].username;
        }

        return '';
    }

    scrollToItem(itemName) {
        const content = $(ReactDOM.findDOMNode(this.refs.searchPopover)).find('.popover-content');
        const visibleContentHeight = content[0].clientHeight;
        const actualContentHeight = content[0].scrollHeight;

        if (this.state.suggestions.length > 0 && visibleContentHeight < actualContentHeight) {
            const contentTop = content.scrollTop();
            const contentTopPadding = parseInt(content.css('padding-top'), 10);
            const contentBottomPadding = parseInt(content.css('padding-top'), 10);

            const item = $(this.refs[itemName]);
            const itemTop = item[0].offsetTop - parseInt(item.css('margin-top'), 10);
            const itemBottom = item[0].offsetTop + item.height() + parseInt(item.css('margin-bottom'), 10);

            if (itemTop - contentTopPadding < contentTop) {
                // the item is off the top of the visible space
                content.scrollTop(itemTop - contentTopPadding);
            } else if (itemBottom + contentTopPadding + contentBottomPadding > contentTop + visibleContentHeight) {
                // the item has gone off the bottom of the visible space
                content.scrollTop(itemBottom - visibleContentHeight + contentTopPadding + contentBottomPadding);
            }
        }
    }

    updateSuggestions(mode, filter) {
        let suggestions = [];

        if (mode === 'channels') {
            let channels = ChannelStore.getAll();

            if (filter) {
                channels = channels.filter((channel) => channel.name.startsWith(filter) && channel.type !== 'D');
            } else {
                // don't show direct channels
                channels = channels.filter((channel) => channel.type !== 'D');
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

    renderChannelSuggestion(channel) {
        let className = 'search-autocomplete__item';
        if (channel.name === this.getSelection()) {
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
    }

    renderUserSuggestion(user) {
        let className = 'search-autocomplete__item';
        if (user.username === this.getSelection()) {
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
    }

    render() {
        if (!this.state.show || this.state.suggestions.length === 0) {
            return null;
        }

        let suggestions = [];

        if (this.state.mode === 'channels') {
            const publicChannels = this.state.suggestions.filter((channel) => channel.type === Constants.OPEN_CHANNEL);
            if (publicChannels.length > 0) {
                suggestions.push(
                    <div
                        key='public-channel-divider'
                        className='search-autocomplete__divider'
                    >
                        {'Public ' + Utils.getChannelTerm(Constants.OPEN_CHANNEL) + 's'}
                    </div>
                );
                suggestions = suggestions.concat(publicChannels.map(this.renderChannelSuggestion));
            }

            const privateChannels = this.state.suggestions.filter((channel) => channel.type === Constants.PRIVATE_CHANNEL);
            if (privateChannels.length > 0) {
                suggestions.push(
                    <div
                        key='private-channel-divider'
                        className='search-autocomplete__divider'
                    >
                        {'Private ' + Utils.getChannelTerm(Constants.PRIVATE_CHANNEL) + 's'}
                    </div>
                );
                suggestions = suggestions.concat(privateChannels.map(this.renderChannelSuggestion));
            }
        } else if (this.state.mode === 'users') {
            suggestions = this.state.suggestions.map(this.renderUserSuggestion);
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
