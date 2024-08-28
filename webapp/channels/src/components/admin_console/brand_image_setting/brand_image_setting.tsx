// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import {
    uploadBrandImage,
    deleteBrandImage,
    uploadLightLogoImage,
    deleteLightLogoImage,
    uploadDarkLogoImage,
    deleteDarkLogoImage,
    uploadBackgroundImage,
    deleteBackgroundImage,
    uploadFaviconImage,
    deleteFaviconImage,
} from 'actions/admin_actions.jsx';

import FormError from 'components/form_error';
import WithTooltip from 'components/with_tooltip';

import {Constants} from 'utils/constants';

const HTTP_STATUS_OK = 200;

type Props = {

    /*
   * Set for testing purpose
   */
    id?: string;

    /*
   * Set to disable the setting
   */
    disabled: boolean;

    /*
   * Set the save needed in the admin schema settings to trigger the save button to turn on
   */
    setSaveNeeded: () => void;

    /*
   * Registers the function suppose to be run when the save button is pressed
   */
    registerSaveAction: (saveAction: () => Promise<unknown>) => void;

    /*
   * Unregisters the function on unmount of the component suppose to be run when the save button is pressed
   */
    unRegisterSaveAction: (saveAction: () => Promise<unknown>) => void;
};

type State = {
    deleteBrandImage: boolean;
    brandImage?: Blob;
    brandImageExists: boolean;
    brandImageTimestamp: number;
    error: string;
};

export default class BrandImageSetting extends React.PureComponent<Props, State> {
    private imageRef: React.RefObject<HTMLImageElement>;
    private fileInputRef: React.RefObject<HTMLInputElement>;

    constructor(props: Props) {
        super(props);

        this.state = {
            deleteBrandImage: false,
            brandImageExists: false,
            brandImageTimestamp: Date.now(),
            error: '',
        };

        this.imageRef = React.createRef();
        this.fileInputRef = React.createRef();
    }

    getImageUrl = () => {
        if (this.props.id === 'CustomBrandLightLogoImage') {
            return Client4.getCustomLightLogoUrl(String(this.state.brandImageTimestamp));
        }
        if (this.props.id === 'CustomBrandDarkLogoImage') {
            return Client4.getCustomDarkLogoUrl(String(this.state.brandImageTimestamp));
        }
        if (this.props.id === 'CustomBrandBackgroundImage') {
            return Client4.getCustomBackgroundUrl(String(this.state.brandImageTimestamp));
        }
        if (this.props.id === 'CustomBrandFaviconImage') {
            return Client4.getCustomFaviconUrl(String(this.state.brandImageTimestamp));
        }
        return Client4.getBrandImageUrl(String(this.state.brandImageTimestamp));
    };

    componentDidMount() {
        fetch(
            this.getImageUrl(),
        ).then((resp) => {
            if (resp.status === HTTP_STATUS_OK) {
                this.setState({brandImageExists: true});
            } else {
                this.setState({brandImageExists: false});
            }
        }).catch((err) => {
            console.error(`unable to retrieve brand image: ${err}`); //eslint-disable-line no-console
            this.setState({brandImageExists: false});
        });

        this.props.registerSaveAction(this.handleSave);
    }

    componentWillUnmount() {
        this.props.unRegisterSaveAction(this.handleSave);
    }

    componentDidUpdate() {
        if (this.imageRef.current) {
            const reader = new FileReader();

            const img = this.imageRef.current;
            reader.onload = (e) => {
                const src =
          e.target?.result instanceof ArrayBuffer ? e.target?.result.toString() : e.target?.result;

                if (src) {
                    img.setAttribute('src', src);
                }
            };

            if (this.state.brandImage) {
                reader.readAsDataURL(this.state.brandImage);
            }
        }
    }

    handleImageChange = () => {
        if (!this.fileInputRef.current) {
            return;
        }
        const element = this.fileInputRef.current;
        if (element.files && element.files.length > 0) {
            this.props.setSaveNeeded();
            this.setState({
                brandImage: element.files[0],
                deleteBrandImage: false,
            });
        }
    };

    handleDeleteButtonPressed = () => {
        this.setState({
            deleteBrandImage: true,
            brandImage: undefined,
            brandImageExists: false,
        });
        this.props.setSaveNeeded();
    };

    handleSave = async () => {
        this.setState({
            error: '',
        });

        let deleteAction = deleteBrandImage;
        let uploadAction = uploadBrandImage;
        switch (this.props.id) {
        case 'CustomBrandImage':
            deleteAction = deleteBrandImage;
            uploadAction = uploadBrandImage;
            break;
        case 'CustomBrandLightLogoImage':
            deleteAction = deleteLightLogoImage;
            uploadAction = uploadLightLogoImage;
            break;
        case 'CustomBrandDarkLogoImage':
            deleteAction = deleteDarkLogoImage;
            uploadAction = uploadDarkLogoImage;
            break;
        case 'CustomBrandBackgroundImage':
            deleteAction = deleteBackgroundImage;
            uploadAction = uploadBackgroundImage;
            break;
        case 'CustomBrandFaviconImage':
            deleteAction = deleteFaviconImage;
            uploadAction = uploadFaviconImage;
            break;
        }

        let error;
        if (this.state.deleteBrandImage) {
            await deleteAction(
                () => {
                    this.setState({
                        deleteBrandImage: false,
                        brandImageExists: false,
                        brandImage: undefined,
                    });
                },
                (err: Error) => {
                    error = err;
                    this.setState({
                        error: err.message,
                    });
                },
            );
        } else if (this.state.brandImage) {
            await uploadAction(
                this.state.brandImage,
                () => {
                    this.setState({
                        brandImageExists: true,
                        brandImage: undefined,
                        brandImageTimestamp: Date.now(),
                    });
                },
                (err: Error) => {
                    error = err;
                    this.setState({
                        error: err.message,
                    });
                },
            );
        }
        return {error};
    };

    render() {
        let img = null;
        if (this.state.brandImage) {
            img = (
                <div className='remove-image__img mb-5'>
                    <img
                        ref={this.imageRef}
                        alt='brand image'
                        src=''
                    />
                </div>
            );
        } else if (this.state.brandImageExists) {
            let overlay;
            if (!this.props.disabled) {
                overlay = (
                    <WithTooltip
                        id='removeIcon'
                        title={
                            <FormattedMessage
                                id='admin.team.removeBrandImage'
                                defaultMessage='Remove brand image'
                            />}
                        placement='right'
                    >
                        <button
                            type='button'
                            className='remove-image__btn'
                            onClick={this.handleDeleteButtonPressed}
                        >
                            <span aria-hidden={true}>{'×'}</span>
                        </button>
                    </WithTooltip>
                );
            }
            img = (
                <div className={'remove-image__img mb-5 ' + (this.props.id === 'CustomBrandDarkLogoImage' ? 'bg--dark' : '')}>
                    <img
                        alt='brand image'
                        src={this.getImageUrl()}
                    />
                    {overlay}
                </div>
            );
        } else {
            img = (
                <p className='mt-2'>
                    {this.props.id === 'CustomBrandImage' && (
                        <FormattedMessage
                            id='admin.team.noBrandImage'
                            defaultMessage='No brand image uploaded'
                        />
                    )}
                    {this.props.id === 'CustomBrandLightLogoImage' && (
                        <FormattedMessage
                            id='admin.team.noBrandLightLogo'
                            defaultMessage='No light logo image uploaded'
                        />
                    )}
                    {this.props.id === 'CustomBrandDarkLogoImage' && (
                        <FormattedMessage
                            id='admin.team.noBrandDarkLogo'
                            defaultMessage='No dark logo image uploaded'
                        />
                    )}
                    {this.props.id === 'CustomBrandBackgroundImage' && (
                        <FormattedMessage
                            id='admin.team.noBrandBackground'
                            defaultMessage='No background image uploaded'
                        />
                    )}
                    {this.props.id === 'CustomBrandFaviconImage' && (
                        <FormattedMessage
                            id='admin.team.noBrandFavicon'
                            defaultMessage='No favicon image uploaded'
                        />
                    )}
                </p>
            );
        }

        return (
            <div
                data-testid={this.props.id}
                className='form-group'
            >
                <label className='control-label col-sm-4'>
                    {this.props.id === 'CustomBrandImage' && (
                        <FormattedMessage
                            id='admin.team.brandImageTitle'
                            defaultMessage='Custom Brand Image:'
                        />
                    )}
                    {this.props.id === 'CustomBrandLightLogoImage' && (
                        <FormattedMessage
                            id='admin.team.brandLightLogoTitle'
                            defaultMessage='(Enterprise Only) Custom logo for light backgrounds:'
                        />
                    )}
                    {this.props.id === 'CustomBrandDarkLogoImage' && (
                        <FormattedMessage
                            id='admin.team.brandDarkLogoTitle'
                            defaultMessage='(Enterprise Only) Custom logo for dark backgrounds:'
                        />
                    )}
                    {this.props.id === 'CustomBrandBackgroundImage' && (
                        <FormattedMessage
                            id='admin.team.brandBackgroundTitle'
                            defaultMessage='(Enterprise Only) Login page background image:'
                        />
                    )}
                    {this.props.id === 'CustomBrandFaviconImage' && (
                        <FormattedMessage
                            id='admin.team.brandFaviconTitle'
                            defaultMessage='(Enterprise Only) Custom Favicon:'
                        />
                    )}
                </label>
                <div className='col-sm-8'>
                    <div className='remove-image'>{img}</div>
                </div>
                <div className='col-sm-4'/>
                <div className='col-sm-8'>
                    <div className='file__upload mt-5'>
                        <button
                            type='button'
                            className='btn btn-tertiary'
                            disabled={this.props.disabled}
                        >
                            <FormattedMessage
                                id='admin.team.chooseImage'
                                defaultMessage='Select Image'
                            />
                        </button>
                        <input
                            ref={this.fileInputRef}
                            type='file'
                            accept={Constants.ACCEPT_STATIC_IMAGE}
                            disabled={this.props.disabled}
                            onChange={this.handleImageChange}
                        />
                    </div>
                    <br/>
                    <FormError error={this.state.error}/>
                    <p className='help-text m-0'>
                        {this.props.id === 'CustomBrandImage' && (
                            <FormattedMessage
                                id='admin.team.uploadDesc'
                                defaultMessage='Customize your user experience by adding a custom image to your login screen. Recommended maximum image size is less than 2 MB.'
                            />
                        )}
                        {this.props.id === 'CustomBrandLightLogoImage' && (
                            <FormattedMessage
                                id='admin.team.uploadDescLightLogo'
                                defaultMessage='Logos must be at least 100px in height in SVG or transparent PNG formats.'
                            />
                        )}
                        {this.props.id === 'CustomBrandDarkLogoImage' && (
                            <FormattedMessage
                                id='admin.team.uploadDescDarkLogo'
                                defaultMessage='Logos must be at least 100px in height in SVG or transparent PNG formats.'
                            />
                        )}
                        {this.props.id === 'CustomBrandBackgroundImage' && (
                            <FormattedMessage
                                id='admin.team.uploadDescBackground'
                                defaultMessage='Add a custom background image to your login screen. It’s best to ensure text is still legible when placed on top.'
                            />
                        )}
                        {this.props.id === 'CustomBrandFaviconImage' && (
                            <FormattedMessage
                                id='admin.team.uploadDescFavicon'
                                defaultMessage='This is the icon that will display in the browser tab when your site is viewed in a web browser. This image should be 16x16 pixels.'
                            />
                        )}
                    </p>
                </div>
            </div>
        );
    }
}
