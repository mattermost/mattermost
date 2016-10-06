// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import * as Utils from 'utils/utils.jsx';
import UserStore from 'stores/user_store.jsx';
import React from 'react';
import {Popover, OverlayTrigger} from 'react-bootstrap';

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
        let email = '';
        let statusClass = '';
        if (this.props.status) {
            statusClass = 'status-' + this.props.status;
        }
        if (this.props.user) {
            email = this.props.user.email;
            var dataContent = [];
            dataContent.push(
                <img
                    className='user-popover__image'
                    src={this.props.src}
                    height='128'
                    width='128'
                    key='user-popover-image'
                />
                );
            const fullname = Utils.getFullName(this.props.user);
            if (fullname) {
                dataContent.push(
                    <div
                        data-toggle='tooltip'
                        title={fullname}
                        key='user-popover-fullname'
                    >
                        <p
                            className='text-nowrap'
                        >
                            {fullname}
                        </p>
                    </div>
                        );
            }
            if (global.window.mm_config.ShowEmailAddress === 'true' || UserStore.isSystemAdminForCurrentUser() || this.props.user.id === UserStore.getCurrentId()) {
                dataContent.push(
                    <div
                        data-toggle='tooltip'
                        title={email}
                        key='user-popover-email'
                    >
                        <a
                            href={'mailto:' + email}
                            className='text-nowrap text-lowercase user-popover__email'
                        >
                            {email}
                        </a>
                    </div>
                );
            }
            return (
                <OverlayTrigger
                    trigger='click'
                    placement='right'
                    rootClose={true}
                    overlay={
                        <Popover
                            title={'@' + this.props.user.username}
                            id='user-profile-popover'
                        >
                            {dataContent}
                        </Popover>
                }
                >
                    <span className={`status-wrapper ${statusClass}`}>
                        <img
                            className='more-modal__image'
                            width={this.props.width}
                            height={this.props.width}
                            src={this.props.src}
                        />
                    </span>
                </OverlayTrigger>
            );
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
    height: React.PropTypes.string,
    user: React.PropTypes.object
};
