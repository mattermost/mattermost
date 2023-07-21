// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import {Constants} from 'utils/constants';
import * as FileUtils from 'utils/file_utils';
import {localizeMessage} from 'utils/utils';

import './picture_selector.scss';

type Props = {
    name: string;
    src?: string;
    defaultSrc?: string;
    placeholder?: React.ReactNode;
    loadingPicture?: boolean;
    onOpenDialog?: () => void;
    onSelect: (file: File) => void;
    onRemove: () => void;
};

const PictureSelector: React.FC<Props> = (props: Props) => {
    const {name, src, defaultSrc, placeholder, loadingPicture, onSelect, onRemove} = props;

    const [image, setImage] = useState<string>();
    const [orientationStyles, setOrientationStyles] = useState<{transform: any; transformOrigin: any}>();

    const inputRef: React.RefObject<HTMLInputElement> = React.createRef();
    const selectButton: React.RefObject<HTMLButtonElement> = React.createRef();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            const reader = new FileReader();
            reader.onload = (ev) => {
                setImage(URL.createObjectURL(file));

                const orientation = FileUtils.getExifOrientation(ev.target!.result! as ArrayBuffer);
                setOrientationStyles(FileUtils.getOrientationStyles(orientation));
            };
            reader.readAsArrayBuffer(file);

            onSelect(file);
        }
    };

    const handleInputFile = () => {
        if (props.onOpenDialog) {
            props.onOpenDialog();
        }

        if (!inputRef || !inputRef.current) {
            return;
        }

        selectButton.current?.blur();

        inputRef.current.value = '';
        inputRef.current.click();
    };

    const handleRemove = () => {
        onRemove();
        if (defaultSrc) {
            setImage(defaultSrc);
        } else {
            setImage(undefined);
        }
    };

    useEffect(() => {
        if (!image) {
            if (src) {
                setImage(src);
            } else if (defaultSrc) {
                setImage(defaultSrc);
            }
        }
    }, [src, image]);

    let removeButton;
    if (image && image !== defaultSrc) {
        removeButton = (
            <button
                data-testid='PictureSelector__removeButton'
                className='PictureSelector__removeButton'
                disabled={loadingPicture}
                onClick={handleRemove}
            >
                <FormattedMessage
                    id='picture_selector.remove_picture'
                    defaultMessage='Remove picture'
                />
            </button>
        );
    }

    return (
        <div className='PictureSelector'>
            <input
                name={name}
                data-testid={`PictureSelector__input-${name}`}
                ref={inputRef}
                className='PictureSelector__input hidden'
                accept={Constants.ACCEPT_STATIC_IMAGE}
                type='file'
                onChange={handleFileChange}
                disabled={loadingPicture}
                aria-hidden={true}
                tabIndex={-1}
            />
            <div className='PictureSelector__imageContainer'>
                <div
                    aria-label={localizeMessage('picture_selector.image.ariaLabel', 'Picture selector image')}
                    className='PictureSelector__image'
                    style={{
                        backgroundImage: 'url(' + image + ')',
                        ...orientationStyles,
                    }}
                >
                    {!image && placeholder}
                </div>
                <button
                    ref={selectButton}
                    data-testid='PictureSelector__selectButton'
                    className='PictureSelector__selectButton'
                    disabled={loadingPicture}
                    onClick={handleInputFile}
                    aria-label={localizeMessage('picture_selector.select_button.ariaLabel', 'Select picture')}
                >
                    <i className='icon icon-pencil-outline'/>
                </button>
            </div>
            {removeButton}
        </div>
    );
};

export default PictureSelector;
