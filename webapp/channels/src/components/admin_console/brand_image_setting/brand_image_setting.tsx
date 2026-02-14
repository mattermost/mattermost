// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import {uploadBrandImage, deleteBrandImage} from 'actions/admin_actions.jsx';

import SettingSet from 'components/admin_console/setting_set';
import useDidUpdate from 'components/common/hooks/useDidUpdate';
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

const BrandImageSetting = ({
    id,
    disabled,
    setSaveNeeded,
    registerSaveAction,
    unRegisterSaveAction,
}: Props) => {
    const imageRef = useRef<HTMLImageElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [brandImage, setBrandImage] = useState<Blob | undefined>();
    const [shouldDeleteBrandImage, setShouldDeleteBrandImage] = useState(false);
    const [brandImageExists, setBrandImageExists] = useState(false);
    const [brandImageTimestamp, setBrandImageTimestamp] = useState(Date.now());

    const [errorFromState, setErrorFromState] = useState('');

    useEffect(() => {
        const handleSave = async () => {
            setErrorFromState('');

            let error;
            if (shouldDeleteBrandImage) {
                await deleteBrandImage(
                    () => {
                        setShouldDeleteBrandImage(false);
                        setBrandImageExists(false);
                        setBrandImage(undefined);
                    },
                    (err: Error) => {
                        error = err;
                        setErrorFromState(err.message);
                    },
                );
            } else if (brandImage) {
                await uploadBrandImage(
                    brandImage,
                    () => {
                        setBrandImageExists(true);
                        setBrandImage(undefined);
                        setBrandImageTimestamp(Date.now());
                    },
                    (err: Error) => {
                        error = err;
                        setErrorFromState(err.message);
                    },
                );
            }
            return {error};
        };

        fetch(
            Client4.getBrandImageUrl(String(brandImageTimestamp)),
        ).then((resp) => {
            if (resp.status === HTTP_STATUS_OK) {
                setBrandImageExists(true);
            } else {
                setBrandImageExists(false);
            }
        }).catch((err) => {
            console.error(`unable to retrieve brand image: ${err}`); //eslint-disable-line no-console
            setBrandImageExists(false);
        });

        registerSaveAction(handleSave);

        return () => {
            unRegisterSaveAction(handleSave);
        };

        /* eslint-disable-next-line react-hooks/exhaustive-deps --
         * This 'useEffect' should only run once during mount.
         **/
    }, []);

    useDidUpdate(() => {
        if (imageRef.current) {
            const reader = new FileReader();

            const img = imageRef.current;
            reader.onload = (e) => {
                const src =
                e.target?.result instanceof ArrayBuffer ? e.target?.result.toString() : e.target?.result;

                if (src) {
                    img.setAttribute('src', src);
                }
            };

            if (brandImage) {
                reader.readAsDataURL(brandImage);
            }
        }
    }, [brandImage]);

    const handleSelectClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleImageChange = useCallback(() => {
        if (!fileInputRef.current) {
            return;
        }
        const element = fileInputRef.current;
        if (element.files && element.files.length > 0) {
            setSaveNeeded();
            setBrandImage(element.files[0]);
            setShouldDeleteBrandImage(false);
        }
    }, [setSaveNeeded]);

    const handleDeleteButtonPressed = useCallback(() => {
        setShouldDeleteBrandImage(true);
        setBrandImage(undefined);
        setBrandImageExists(false);

        setSaveNeeded();
    }, [setSaveNeeded]);

    let img = null;
    if (brandImage) {
        img = (
            <div className='remove-image__img mb-5'>
                <img
                    ref={imageRef}
                    alt='brand image'
                    src=''
                />
            </div>
        );
    } else if (brandImageExists) {
        let overlay;
        if (!disabled) {
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
                        data-testid='remove-image__btn'
                        onClick={handleDeleteButtonPressed}
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
                        String(brandImageTimestamp),
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
            inputId={id}
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
                    disabled={disabled}
                    onClick={handleSelectClick}
                >
                    <FormattedMessage
                        id='admin.team.chooseImage'
                        defaultMessage='Select Image'
                    />
                </button>
                <input
                    ref={fileInputRef}
                    data-testid='file__upload-input'
                    type='file'
                    accept={Constants.ACCEPT_STATIC_IMAGE}
                    disabled={disabled}
                    onChange={handleImageChange}
                />
            </div>
            <FormError error={errorFromState}/>
        </SettingSet>
    );
};

export default memo(BrandImageSetting);
