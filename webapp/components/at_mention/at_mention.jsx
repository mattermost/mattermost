// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

export default class AtMention extends React.PureComponent {
    static propTypes = {
        mentionName: PropTypes.string.isRequired,
        usersByUsername: PropTypes.object.isRequired,
        actions: PropTypes.shape({
            searchForTerm: PropTypes.func.isRequired
        }).isRequired
    };

    constructor(props) {
        super(props);

        this.state = {
            username: this.getUsernameFromMentionName(props)
        };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.mentionName !== this.props.mentionName || nextProps.usersByUsername !== this.props.usersByUsername) {
            this.setState({
                username: this.getUsernameFromMentionName(nextProps)
            });
        }
    }

    getUsernameFromMentionName(props) {
        let mentionName = props.mentionName;

        while (mentionName.length > 0) {
            if (props.usersByUsername[mentionName]) {
                return props.usersByUsername[mentionName].username;
            }

            // Repeatedly trim off trailing punctuation in case this is at the end of a sentence
            if ((/[._-]$/).test(mentionName)) {
                mentionName = mentionName.substring(0, mentionName.length - 1);
            } else {
                break;
            }
        }

        return '';
    }

    search = (e) => {
        e.preventDefault();

        this.props.actions.searchForTerm(this.state.username);
    }

    render() {
        const username = this.state.username;

        if (!username) {
            return <span>{'@' + this.props.mentionName}</span>;
        }

        const suffix = this.props.mentionName.substring(username.length);

        return (
            <span>
                <a
                    className='mention-link'
                    href='#'
                    onClick={this.search}
                >
                    {'@' + username}
                </a>
                {suffix}
            </span>
        );
    }
}
