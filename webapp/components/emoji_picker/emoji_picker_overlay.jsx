// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {Overlay} from 'react-bootstrap';

import EmojiPicker from './emoji_picker.jsx';

export default class EmojiPickerOverlay extends React.PureComponent {
    static propTypes = {
        show: PropTypes.bool.isRequired,
        container: PropTypes.func,
        target: PropTypes.func.isRequired,
        onEmojiClick: PropTypes.func.isRequired,
        onHide: PropTypes.func.isRequired,
        rightOffset: PropTypes.number,
        topOffset: PropTypes.number,
        spaceRequiredAbove: PropTypes.number,
        spaceRequiredBelow: PropTypes.number
    }

    // Reasonable defaults calculated from from the center channel
    static defaultProps = {
        spaceRequiredAbove: 422,
        spaceRequiredBelow: 436
    }

    constructor(props) {
        super(props);

        this.state = {
            placement: 'top'
        };
    }

    componentWillUpdate(nextProps) {
        if (nextProps.show && !this.props.show) {
            const targetBounds = nextProps.target().getBoundingClientRect();

            let placement;
            if (targetBounds.top > nextProps.spaceRequiredAbove) {
                placement = 'top';
            } else if (window.innerHeight - targetBounds.bottom > nextProps.spaceRequiredBelow) {
                placement = 'bottom';
            } else {
                placement = 'left';
            }

            this.setState({placement});
        }
    }

    render() {
        return (
            <Overlay
                show={this.props.show}
                placement={this.state.placement}
                rootClose={true}
                container={this.props.container}
                onHide={this.props.onHide}
                target={this.props.target}
                animation={false}
            >
                <EmojiPicker
                    onEmojiClick={this.props.onEmojiClick}
                    rightOffset={this.props.rightOffset}
                    topOffset={this.props.topOffset}
                />
            </Overlay>
        );
    }
}
