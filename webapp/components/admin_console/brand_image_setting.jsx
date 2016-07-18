// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';

import Client from 'client/web_client.jsx';
import * as Utils from 'utils/utils.jsx';

import FormError from 'components/form_error.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';

export default class BrandImageSetting extends React.Component {
    static get propTypes() {
        return {
            disabled: React.PropTypes.bool.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleImageChange = this.handleImageChange.bind(this);
        this.handleImageSubmit = this.handleImageSubmit.bind(this);

        this.state = {
            brandImage: null,
            brandImageExists: false,
            brandImageTimestamp: Date.now(),
            uploading: false,
            uploadCompleted: false,
            error: ''
        };
    }

    componentWillMount() {
        $.get(Client.getAdminRoute() + '/get_brand_image?t=' + this.state.brandImageTimestamp).done(() => {
            this.setState({brandImageExists: true});
        });
    }

    componentDidUpdate() {
        if (this.refs.image) {
            const reader = new FileReader();

            const img = this.refs.image;
            reader.onload = (e) => {
                $(img).attr('src', e.target.result);
            };

            reader.readAsDataURL(this.state.brandImage);
        }
    }

    handleImageChange() {
        const element = $(this.refs.fileInput);

        if (element.prop('files').length > 0) {
            this.setState({
                brandImage: element.prop('files')[0]
            });
        }
    }

    handleImageSubmit(e) {
        e.preventDefault();

        if (!this.state.brandImage) {
            return;
        }

        if (this.state.uploading) {
            return;
        }

        $(ReactDOM.findDOMNode(this.refs.upload)).button('loading');

        this.setState({
            uploading: true,
            error: ''
        });

        Client.uploadBrandImage(
            this.state.brandImage,
            () => {
                $(ReactDOM.findDOMNode(this.refs.upload)).button('complete');

                this.setState({
                    brandImageExists: true,
                    brandImage: null,
                    brandImageTimestamp: Date.now(),
                    uploading: false
                });
            },
            (err) => {
                $(ReactDOM.findDOMNode(this.refs.upload)).button('reset');

                this.setState({
                    uploading: false,
                    error: err.message
                });
            }
        );
    }

    render() {
        let btnPrimaryClass = 'btn';
        if (this.state.brandImage) {
            btnPrimaryClass += ' btn-primary';
        }

        let letbtnDefaultClass = 'btn';
        if (!this.props.disabled) {
            letbtnDefaultClass += ' btn-default';
        }

        let img = null;
        if (this.state.brandImage) {
            img = (
                <img
                    ref='image'
                    className='brand-img'
                    src=''
                />
            );
        } else if (this.state.brandImageExists) {
            img = (
                <img
                    className='brand-img'
                    src={Client.getAdminRoute() + '/get_brand_image?t=' + this.state.brandImageTimestamp}
                />
            );
        } else {
            img = (
                <p>
                    <FormattedMessage
                        id='admin.team.noBrandImage'
                        defaultMessage='No brand image uploaded'
                    />
                </p>
            );
        }

        return (
            <div className='form-group'>
                <label className='control-label col-sm-4'>
                    <FormattedMessage
                        id='admin.team.brandImageTitle'
                        defaultMessage='Custom Brand Image:'
                    />
                </label>
                <div className='col-sm-8'>
                    {img}
                </div>
                <div className='col-sm-4'/>
                <div className='col-sm-8'>
                    <div className='file__upload'>
                        <button
                            className={letbtnDefaultClass}
                            disabled={this.props.disabled}
                        >
                            <FormattedMessage
                                id='admin.team.chooseImage'
                                defaultMessage='Choose New Image'
                            />
                        </button>
                        <input
                            ref='fileInput'
                            type='file'
                            accept='.jpg,.png,.bmp'
                            disabled={this.props.disabled}
                            onChange={this.handleImageChange}
                        />
                    </div>
                    <button
                        className={btnPrimaryClass}
                        disabled={this.props.disabled || !this.state.brandImage}
                        onClick={this.handleImageSubmit}
                        id='upload-button'
                        data-loading-text={'<span class=\'fa fa-refresh fa-rotate\'></span> ' + Utils.localizeMessage('admin.team.uploading', 'Uploading..')}
                        data-complete-text={'<span class=\'fa fa-check\'></span> ' + Utils.localizeMessage('admin.team.uploaded', 'Uploaded!')}
                    >
                        <FormattedMessage
                            id='admin.team.upload'
                            defaultMessage='Upload'
                        />
                    </button>
                    <br/>
                    <FormError error={this.state.error}/>
                    <p className='help-text no-margin'>
                        <FormattedHTMLMessage
                            id='admin.team.uploadDesc'
                            defaultMessage='Customize your user experience by adding a custom image to your login screen. See examples at <a href="http://docs.mattermost.com/administration/config-settings.html#custom-branding" target="_blank">docs.mattermost.com/administration/config-settings.html#custom-branding</a>.'
                        />
                    </p>
                </div>
            </div>
        );
    }
}
