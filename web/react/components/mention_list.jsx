// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from '../stores/user_store.jsx';
import SearchStore from '../stores/search_store.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Mention from './mention.jsx';

import Constants from '../utils/constants.jsx';
import * as Utils from '../utils/utils.jsx';
var ActionTypes = Constants.ActionTypes;

var MAX_HEIGHT_LIST = 292;
var MAX_ITEMS_IN_LIST = 25;
var ITEM_HEIGHT = 36;

export default class MentionList extends React.Component {
    constructor(props) {
        super(props);

        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleMouseEnter = this.handleMouseEnter.bind(this);
        this.getSelection = this.getSelection.bind(this);
        this.addCurrentMention = this.addCurrentMention.bind(this);
        this.addFirstMention = this.addFirstMention.bind(this);
        this.isEmpty = this.isEmpty.bind(this);
        this.scrollToMention = this.scrollToMention.bind(this);
        this.onScroll = this.onScroll.bind(this);
        this.onMentionListKey = this.onMentionListKey.bind(this);
        this.onClick = this.onClick.bind(this);

        this.state = {excludeUsers: [], mentionText: '-1', selectedMention: 0, selectedUsername: ''};
    }
    onScroll() {
        if ($('.mentions--top').length) {
            $('#reply_mention_tab .mentions--top').css({bottom: $(window).height() - $('.post-right__scroll #reply_textbox').offset().top});
        }
    }
    onMentionListKey(e) {
        if (!this.isEmpty() && this.state.mentionText !== '-1' && (e.which === 13 || e.which === 9)) {
            e.stopPropagation();
            e.preventDefault();
            this.addCurrentMention();
        } else if (!this.isEmpty() && this.state.mentionText !== '-1' && (e.which === 38 || e.which === 40)) {
            e.stopPropagation();
            e.preventDefault();

            if (e.which === 38) {
                if (this.getSelection(this.state.selectedMention - 1)) {
                    this.setState({selectedMention: this.state.selectedMention - 1, selectedUsername: this.refs['mention' + (this.state.selectedMention - 1)].props.username});
                }
            } else if (e.which === 40) {
                if (this.getSelection(this.state.selectedMention + 1)) {
                    this.setState({selectedMention: this.state.selectedMention + 1, selectedUsername: this.refs['mention' + (this.state.selectedMention + 1)].props.username});
                }
            }

            this.scrollToMention(e.which);
        }
    }
    onClick(e) {
        if (!($('#' + this.props.id).is(e.target) || $('#' + this.props.id).has(e.target).length ||
              ('mentionlist' in this.refs && $(ReactDOM.findDOMNode(this.refs.mentionlist)).has(e.target).length))) {
            this.setState({mentionText: '-1'});
        }
    }
    componentDidMount() {
        SearchStore.addMentionDataChangeListener(this.onListenerChange);

        $('.post-right__scroll').scroll(this.onScroll);

        $('body').on('keydown.mentionlist', '#' + this.props.id, this.onMentionListKey);
        $(document).click(this.onClick);
    }
    componentWillUnmount() {
        SearchStore.removeMentionDataChangeListener(this.onListenerChange);
        $('body').off('keydown.mentionlist', '#' + this.props.id);
    }

    /*
     *  This component is poorly designed, nessesitating some state modification
     *  in the componentDidUpdate function. This is generally discouraged as it
     *  is a performance issue and breaks with good react design. This component
     *  should be redesigned.
     */
    componentDidUpdate() {
        if (this.state.mentionText !== '-1') {
            if (this.state.selectedUsername !== '' && (!this.getSelection(this.state.selectedMention) || this.state.selectedUsername !== this.refs['mention' + this.state.selectedMention].props.username)) {
                var tempSelectedMention = -1;
                var foundMatch = false;
                while (tempSelectedMention < this.state.selectedMention && this.getSelection(++tempSelectedMention)) {
                    if (this.state.selectedUsername === this.refs['mention' + tempSelectedMention].props.username) {
                        this.setState({selectedMention: tempSelectedMention}); //eslint-disable-line react/no-did-update-set-state
                        foundMatch = true;
                        break;
                    }
                }
                if (this.getSelection(0) && !foundMatch) {
                    this.setState({selectedMention: 0, selectedUsername: this.refs.mention0.props.username}); //eslint-disable-line react/no-did-update-set-state
                }
            }
        } else if (this.state.selectedMention !== 0) {
            this.setState({selectedMention: 0, selectedUsername: ''}); //eslint-disable-line react/no-did-update-set-state
        }
    }
    onListenerChange(id, mentionText) {
        if (id !== this.props.id) {
            return;
        }

        var newState = this.state;
        if (mentionText != null) {
            newState.mentionText = mentionText;
        }

        this.setState(newState);
    }
    handleClick(name) {
        AppDispatcher.handleViewAction({
            type: ActionTypes.RECIEVED_ADD_MENTION,
            id: this.props.id,
            username: name
        });

        this.setState({mentionText: '-1'});
    }
    handleMouseEnter(listId) {
        this.setState({selectedMention: listId, selectedUsername: this.refs['mention' + listId].props.username});
    }
    getSelection(listId) {
        if (!this.refs['mention' + listId]) {
            return false;
        }
        return true;
    }
    addCurrentMention() {
        if (this.getSelection(this.state.selectedMention)) {
            this.refs['mention' + this.state.selectedMention].handleClick();
        } else {
            this.addFirstMention();
        }
    }
    addFirstMention() {
        if (!this.refs.mention0) {
            return;
        }
        this.refs.mention0.handleClick();
    }
    isEmpty() {
        return (!this.refs.mention0);
    }
    scrollToMention(keyPressed) {
        var direction;
        if (keyPressed === 38) {
            direction = 'up';
        } else {
            direction = 'down';
        }
        var scrollAmount = 0;

        if (direction === 'up') {
            scrollAmount = '-=' + ($('#' + this.refs['mention' + this.state.selectedMention].props.id + '_mentions').innerHeight() - 5);
        } else if (direction === 'down') {
            scrollAmount = '+=' + ($('#' + this.refs['mention' + this.state.selectedMention].props.id + '_mentions').innerHeight() - 5);
        }

        $('#mentionsbox').animate({
            scrollTop: scrollAmount
        }, 75);
    }
    render() {
        var mentionText = this.state.mentionText;
        if (mentionText === '-1') {
            return null;
        }

        var profiles = UserStore.getActiveOnlyProfiles();
        var users = [];
        for (let id in profiles) {
            if (profiles[id]) {
                users.push(profiles[id]);
            }
        }

        // var all = {};
        // all.username = 'all';
        // all.nickname = '';
        // all.secondary_text = 'Notifies everyone in the team';
        // all.id = 'allmention';
        // users.push(all);

        var channel = {};
        channel.username = 'channel';
        channel.nickname = '';
        channel.secondary_text = 'Notifies everyone in the channel';
        channel.id = 'channelmention';
        users.push(channel);

        users.sort(function sortByUsername(a, b) {
            if (a.username < b.username) {
                return -1;
            }
            if (a.username > b.username) {
                return 1;
            }
            return 0;
        });
        var mentions = [];
        var index = 0;

        for (var i = 0; i < users.length && index < MAX_ITEMS_IN_LIST; i++) {
            if ((users[i].first_name && users[i].first_name.lastIndexOf(mentionText, 0) === 0) ||
                    (users[i].last_name && users[i].last_name.lastIndexOf(mentionText, 0) === 0) ||
                    users[i].username.lastIndexOf(mentionText, 0) === 0) {
                let isFocused = '';
                if (this.state.selectedMention === index) {
                    isFocused = 'mentions-focus';
                }

                if (!users[i].secondary_text) {
                    users[i].secondary_text = Utils.getFullName(users[i]);
                }

                mentions[index] = (
                    <Mention
                        key={'mention_key_' + index}
                        ref={'mention' + index}
                        username={users[i].username}
                        secondary_text={users[i].secondary_text}
                        id={users[i].id}
                        listId={index}
                        isFocused={isFocused}
                        handleMouseEnter={this.handleMouseEnter.bind(this, index)}
                        handleClick={this.handleClick}
                    />
                );
                index++;
            }
        }

        var numMentions = mentions.length;

        if (numMentions < 1) {
            return null;
        }

        var $mentionTab = $('#' + this.props.id);
        var maxHeight = Math.min(MAX_HEIGHT_LIST, $mentionTab.offset().top - 10);
        var style = {
            height: Math.min(maxHeight, (numMentions * ITEM_HEIGHT) + 4),
            width: $mentionTab.parent().width(),
            bottom: $(window).height() - $mentionTab.offset().top,
            left: $mentionTab.offset().left
        };

        return (
            <div
                className='mentions--top'
                style={style}
            >
                <div
                    ref='mentionlist'
                    className='mentions-box'
                    id='mentionsbox'
                >
                    {mentions}
                </div>
            </div>
        );
    }
}

MentionList.propTypes = {
    id: React.PropTypes.string
};
