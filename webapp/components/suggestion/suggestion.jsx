import PropTypes from 'prop-types';

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default class Suggestion extends React.Component {
    static get propTypes() {
        return {
            item: PropTypes.object.isRequired,
            term: PropTypes.string.isRequired,
            matchedPretext: PropTypes.string.isRequired,
            isSelection: PropTypes.bool,
            onClick: PropTypes.func
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
