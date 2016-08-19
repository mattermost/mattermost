// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default class ProfilePicture extends React.Component {
    shouldComponentUpdate(nextProps) {
        if (nextProps.src !== this.props.src) {
            return true;
        }

        if (nextProps.status !== this.props.status) {
            return true;
        }

        if (nextProps.width !== this.props.width) {
            return true;
        }

        if (nextProps.height !== this.props.height) {
            return true;
        }

        return false;
    }

    render() {
        let statusClass = '';
        if (this.props.status) {
            statusClass = 'status-' + this.props.status;
        }

        return (
            <span className={`status-wrapper ${statusClass}`}>
                <img
                    className='more-modal__image'
                    width={this.props.width}
                    height={this.props.width}
                    src={this.props.src}
                />
            </span>
        );
    }
}

ProfilePicture.defaultProps = {
    width: '36',
    height: '36'
};
ProfilePicture.propTypes = {
    src: React.PropTypes.string.isRequired,
    status: React.PropTypes.string,
    width: React.PropTypes.string,
    height: React.PropTypes.string
};
