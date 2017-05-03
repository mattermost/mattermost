// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {Component, PropTypes} from 'react';
import {FormattedMessage} from 'react-intl';

import FormError from 'components/form_error.jsx';

import loadingGif from 'images/load.gif';

export default class SettingPicture extends Component {
    static propTypes = {
        clientError: PropTypes.string,
        serverError: PropTypes.string,
        src: PropTypes.string,
        file: PropTypes.object,
        loadingPicture: PropTypes.bool,
        submitActive: PropTypes.bool,
        submit: PropTypes.func,
        title: PropTypes.string,
        onFileChange: PropTypes.func,
        updateSection: PropTypes.func
    };

    constructor(props) {
        super(props);

        this.state = {
            image: null
        };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.file !== this.props.file) {
            this.setState({image: null});

            this.setPicture(nextProps.file);
        }
    }

    setPicture = (file) => {
        if (file) {
            var reader = new FileReader();

            reader.onload = (e) => {
                this.setState({
                    image: e.target.result
                });
            };
            reader.readAsDataURL(file);
        }
    }

    render() {
        let img;
        if (this.props.file) {
            img = (
                <div
                    className='profile-img-preview'
                    style={{backgroundImage: 'url(' + this.state.image + ')'}}
                />
            );
        } else {
            img = (
                <img
                    ref='image'
                    className='profile-img rounded'
                    src={this.props.src}
                />
            );
        }

        let confirmButton;
        if (this.props.loadingPicture) {
            confirmButton = (
                <img
                    className='spinner'
                    src={loadingGif}
                />
            );
        } else {
            let confirmButtonClass = 'btn btn-sm';
            if (this.props.submitActive) {
                confirmButtonClass += ' btn-primary';
            } else {
                confirmButtonClass += ' btn-inactive disabled';
            }

            confirmButton = (
                <a
                    className={confirmButtonClass}
                    onClick={this.props.submit}
                >
                    <FormattedMessage
                        id='setting_picture.save'
                        defaultMessage='Save'
                    />
                </a>
            );
        }

        return (
            <ul className='section-max'>
                <li className='col-xs-12 section-title'>{this.props.title}</li>
                <li className='col-xs-offset-3 col-xs-8'>
                    <ul className='setting-list'>
                        <li className='setting-list-item'>
                            {img}
                        </li>
                        <li className='setting-list-item'>
                            <FormattedMessage
                                id='setting_picture.help'
                                defaultMessage='Upload a profile picture in BMP, JPG, JPEG or PNG format, at least {width}px in width and {height}px height.'
                                values={{
                                    width: global.mm_config.ProfileWidth,
                                    height: global.mm_config.ProfileHeight
                                }}
                            />
                        </li>
                        <li className='setting-list-item'>
                            <FormError errors={[this.props.clientError, this.props.serverError]}/>
                            <span className='btn btn-sm btn-primary btn-file sel-btn'>
                                <FormattedMessage
                                    id='setting_picture.select'
                                    defaultMessage='Select'
                                />
                                <input
                                    ref='input'
                                    accept='.jpg,.png,.bmp'
                                    type='file'
                                    onChange={this.props.onFileChange}
                                />
                            </span>
                            {confirmButton}
                            <a
                                className='btn btn-sm theme'
                                href='#'
                                onClick={this.props.updateSection}
                            >
                                <FormattedMessage
                                    id='setting_picture.cancel'
                                    defaultMessage='Cancel'
                                />
                            </a>
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
}
