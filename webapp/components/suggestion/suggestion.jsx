// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default class Suggestion extends React.Component {
    static get propTypes() {
        return {
            item: React.PropTypes.object.isRequired,
            term: React.PropTypes.string.isRequired,
            matchedPretext: React.PropTypes.string.isRequired,
            isSelection: React.PropTypes.bool,
            onClick: React.PropTypes.func
        };
    }

    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick(e) {
        e.preventDefault();

        this.props.onClick(this.props.term, this.props.matchedPretext);
    }
}