import PropTypes from 'prop-types';

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {Component} from 'react';
import {FormattedMessage} from 'react-intl';
import exif2css from 'exif2css';

import FormError from 'components/form_error.jsx';
import loadingGif from 'images/load.gif';

import Constants from 'utils/constants.jsx';

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

    componentWillUnmount() {
        if (this.previewBlob) {
            URL.revokeObjectURL(this.previewBlob);
        }
    }

    setPicture = (file) => {
        if (file) {
            this.previewBlob = URL.createObjectURL(file);

            var reader = new FileReader();
            reader.onload = (e) => {
                const orientation = this.getExifOrientation(e.target.result);
                const orientationStyles = this.getOrientationStyles(orientation);

                this.setState({
                    image: this.previewBlob,
                    orientationStyles
                });
            };
            reader.readAsArrayBuffer(file);
        }
    }

    // based on https://stackoverflow.com/questions/7584794/accessing-jpeg-exif-rotation-data-in-javascript-on-the-client-side/32490603#32490603
    getExifOrientation(data) {
        var view = new DataView(data);

        if (view.getUint16(0, false) !== 0xFFD8) {
            return -2;
        }

        var length = view.byteLength;
        var offset = 2;

        while (offset < length) {
            var marker = view.getUint16(offset, false);
            offset += 2;

            if (marker === 0xFFE1) {
                if (view.getUint32(offset += 2, false) !== 0x45786966) {
                    return -1;
                }

                var little = view.getUint16(offset += 6, false) === 0x4949;
                offset += view.getUint32(offset + 4, little);
                var tags = view.getUint16(offset, little);
                offset += 2;

                for (var i = 0; i < tags; i++) {
                    if (view.getUint16(offset + (i * 12), little) === 0x0112) {
                        return view.getUint16(offset + (i * 12) + 8, little);
                    }
                }
            } else if ((marker & 0xFF00) === 0xFF00) {
                offset += view.getUint16(offset, false);
            } else {
                break;
            }
        }
        return -1;
    }

    getOrientationStyles(orientation) {
        const {
            transform,
            'transform-origin': transformOrigin
        } = exif2css(orientation);
        return {transform, transformOrigin};
    }

    render() {
        let img;
        if (this.props.file) {
            const imageStyles = {
                backgroundImage: 'url(' + this.state.image + ')',
                ...this.state.orientationStyles
            };

            img = (
                <div
                    className='profile-img-preview'
                    style={imageStyles}
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
            <ul className='section-max form-horizontal'>
                <li className='col-xs-12 section-title'>{this.props.title}</li>
                <li className='col-xs-offset-3 col-xs-8'>
                    <ul className='setting-list'>
                        <li className='setting-list-item'>
                            {img}
                        </li>
                        <li className='setting-list-item padding-top x2'>
                            <FormattedMessage
                                id='setting_picture.help'
                                defaultMessage='Upload a profile picture in BMP, JPG, JPEG or PNG format, at least {width}px in width and {height}px height.'
                                values={{
                                    width: Constants.PROFILE_WIDTH,
                                    height: Constants.PROFILE_WIDTH
                                }}
                            />
                        </li>
                        <li className='setting-list-item'>
                            <hr/>
                            <FormError
                                errors={[this.props.clientError, this.props.serverError]}
                                type={'modal'}
                            />
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
