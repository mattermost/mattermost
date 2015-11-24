// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SuggestionStore from '../stores/suggestion_store.jsx';
import UserStore from '../stores/user_store.jsx';

class SearchUserSuggestion extends React.Component {
    render() {
        const {item, isSelection, onClick} = this.props;

        let className = 'search-autocomplete__item';
        if (isSelection) {
            className += ' selected';
        }

        return (
            <div
                className={className}
                onClick={onClick}
            >
                <img
                    className='profile-img rounded'
                    src={'/api/v1/users/' + item.id + '/image?time=' + item.update_at}
                />
                {item.username}
            </div>
        );
    }
}

SearchUserSuggestion.propTypes = {
    item: React.PropTypes.object.isRequired,
    isSelection: React.PropTypes.bool,
    onClick: React.PropTypes.func
};

class SearchUserProvider {
    handlePretextChanged(suggestionId, pretext) {
        const captured = (/\bfrom:\s*(\S*)$/i).exec(pretext);
        if (captured) {
            const usernamePrefix = captured[1];

            const users = UserStore.getProfiles();
            let filtered = [];

            for (const id of Object.keys(users)) {
                const user = users[id];

                if (user.username.startsWith(usernamePrefix)) {
                    filtered.push(user);
                }
            }

            filtered = filtered.sort((a, b) => a.username.localeCompare(b.username));

            const usernames = filtered.map((user) => user.username);

            SuggestionStore.setMatchedPretext(suggestionId, usernamePrefix);
            SuggestionStore.addSuggestions(suggestionId, usernames, filtered, SearchUserSuggestion);
        }
    }
}

export default new SearchUserProvider();