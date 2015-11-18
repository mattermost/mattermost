// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChannelStore from '../stores/channel_store.jsx';
import UserStore from '../stores/user_store.jsx';
import UserProfile from './user_profile.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';
import * as utils from '../utils/utils.jsx';
import * as TextFormatting from '../utils/text_formatting.jsx';

export default class SearchResultsItem extends React.Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick(e) {
        e.preventDefault();

        EventHelpers.emitPostFocusEvent(this.props.post.id);
    }

    render() {
        var channelName = '';
        var channel = ChannelStore.get(this.props.post.channel_id);
        var timestamp = UserStore.getCurrentUser().update_at;

        if (channel) {
            channelName = channel.display_name;
            if (channel.type === 'D') {
                channelName = 'Direct Message';
            }
        }

        const formattingOptions = {
            searchTerm: this.props.term,
            mentionHighlight: this.props.isMentionSearch
        };

        return (
            <div
                className='search-item-container post'
                onClick={this.handleClick}
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
                                    {utils.displayDate(this.props.post.create_at) + ' ' + utils.displayTime(this.props.post.create_at)}
                                </time>
                            </li>
                        </ul>
                        <div className='search-item-snippet'>
                            <span
                                onClick={this.handleClick}
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
