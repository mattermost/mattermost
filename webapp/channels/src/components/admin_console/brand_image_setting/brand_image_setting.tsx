// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import {uploadBrandImage, deleteBrandImage} from 'actions/admin_actions.jsx';

import SettingSet from 'components/admin_console/setting_set';
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

    componentDidMount() {
        fetch(
            Client4.getBrandImageUrl(String(this.state.brandImageTimestamp)),
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

    handleSelectClick = () => {
        this.fileInputRef.current?.click();
    };

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

        let error;
        if (this.state.deleteBrandImage) {
            await deleteBrandImage(
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
            await uploadBrandImage(
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
                        title={(
                            <FormattedMessage
                                id='admin.team.removeBrandImage'
                                defaultMessage='Remove brand image'
                            />
                        )}
                        isVertical={false}
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
                <div className='remove-image__img mb-5'>
                    <img
                        alt='brand image'
                        src={Client4.getBrandImageUrl(
                            String(this.state.brandImageTimestamp),
                        )}
                    />
                    {overlay}
                </div>
            );
        } else {
            img = (
                <p className='mt-2'>
                    <FormattedMessage
                        id='admin.team.noBrandImage'
                        defaultMessage='No brand image uploaded'
                    />
                </p>
            );
        }

        return (
            <SettingSet
                inputId={this.props.id}
                helpText={
                    <FormattedMessage
                        id='admin.team.uploadDesc'
                        defaultMessage='Customize your user experience by adding a custom image to your login screen. Recommended maximum image size is less than 2 MB.'
                    />
                }
                label={
                    <FormattedMessage
                        id='admin.team.brandImageTitle'
                        defaultMessage='Custom Brand Image:'
                    />
                }
                setByEnv={false}
            >
                <div>
                    <div className='remove-image'>{img}</div>
                </div>
                <div className='file__upload mt-5'>
                    <button
                        type='button'
                        className='btn btn-tertiary'
                        disabled={this.props.disabled}
                        onClick={this.handleSelectClick}
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
                <FormError error={this.state.error}/>
            </SettingSet>
        );
    }
}
