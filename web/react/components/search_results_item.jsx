// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChannelStore from '../stores/channel_store.jsx';
import UserStore from '../stores/user_store.jsx';
import UserProfile from './user_profile.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';
import * as utils from '../utils/utils.jsx';
import * as TextFormatting from '../utils/text_formatting.jsx';

import Constants from '../utils/constants.jsx';

import {FormattedMessage, FormattedDate} from 'mm-intl';

export default class SearchResultsItem extends React.Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleFocusRHSClick = this.handleFocusRHSClick.bind(this);
    }

    handleClick(e) {
        e.preventDefault();

        EventHelpers.emitPostFocusEvent(this.props.post.id);

        if ($(window).width() < 768) {
            $('.sidebar--right').removeClass('move--left');
            $('.inner__wrap').removeClass('move--left');
        }
    }

    handleFocusRHSClick(e) {
        e.preventDefault();
        EventHelpers.emitPostFocusRightHandSideFromSearch(this.props.post, this.props.isMentionSearch);
    }

    render() {
        var channelName = '';
        var channel = ChannelStore.get(this.props.post.channel_id);
        var timestamp = UserStore.getCurrentUser().update_at;

        if (channel) {
            channelName = channel.display_name;
            if (channel.type === 'D') {
                channelName = (
                    <FormattedMessage
                        id='search_item.direct'
                        defaultMessage='Direct Message'
                    />
                );
            }
        }

        const formattingOptions = {
            searchTerm: this.props.term,
            mentionHighlight: this.props.isMentionSearch
        };

        return (
            <div
                className='search-item-container post'
            >
                <div className='search-channel__name'>{channelName}</div>
                <div className='post__content'>
                    <div className='post__img'>
                        <img
                            src={'/api/v1/users/' + this.props.post.user_id + '/image?time=' + timestamp + '&' + utils.getSessionIndex()}
                            height='36'
                            width='36'
                        />
                    </div>
                    <div>
                        <ul className='post__header'>
                            <li className='col__name'><strong><UserProfile userId={this.props.post.user_id} /></strong></li>
                            <li className='col'>
                                <time className='search-item-time'>
                                    <FormattedDate
                                        value={this.props.post.create_at}
                                        day='numeric'
                                        month='long'
                                        year='numeric'
                                        hour12={true}
                                        hour='2-digit'
                                        minute='2-digit'
                                    />
                                </time>
                            </li>
                            <li>
                                <a
                                    href='#'
                                    className='search-item__jump'
                                    onClick={this.handleClick}
                                >
                                    <FormattedMessage
                                        id='search_item.jump'
                                        defaultMessage='Jump'
                                    />
                                </a>
                            </li>
                            <li>
                                <a
                                    href='#'
                                    className='comment-icon__container search-item__comment'
                                    onClick={this.handleFocusRHSClick}
                                >
                                    <span
                                        className='comment-icon'
                                        dangerouslySetInnerHTML={{__html: Constants.REPLY_ICON}}
                                    />
                                </a>
                            </li>
                        </ul>
                        <div className='search-item-snippet'>
                            <span
                                dangerouslySetInnerHTML={{__html: TextFormatting.formatText(this.props.post.message, formattingOptions)}}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

SearchResultsItem.propTypes = {
    post: React.PropTypes.object,
    isMentionSearch: React.PropTypes.bool,
    term: React.PropTypes.string
};
