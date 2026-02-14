// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import marked from 'marked';
import React, {useEffect, useCallback} from 'react';
import {defineMessage, FormattedDate, FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {ClientLicense, License} from '@mattermost/types/config';

import {previewLicense, uploadLicense} from 'mattermost-redux/actions/admin';
import {getLicenseConfig} from 'mattermost-redux/actions/general';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {closeModal} from 'actions/views/modals';
import {getCurrentLocale} from 'selectors/i18n';
import {isModalOpen} from 'selectors/views/modals';

import SuccessSvg from 'components/common/svg_images_components/success_svg';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import {ModalIdentifiers} from 'utils/constants';
import {getMonthLong} from 'utils/i18n';
import {getSkuDisplayName} from 'utils/subscription';

import type {GlobalState} from 'types/store';

import LicenseDiffView from './license_diff_view';

import './upload_license_modal.scss';

type Props = {
    onExited?: () => void;
    fileObjFromProps: File | null;
}

type ModalStep = 'loading' | 'preview' | 'success';

const UploadLicenseModal = (props: Props): JSX.Element | null => {
    const dispatch = useDispatch();

    const [fileObj] = React.useState<File | null>(props.fileObjFromProps);
    const [isLoading, setIsLoading] = React.useState(false);
    const [serverError, setServerError] = React.useState<string | null>(null);
    const [step, setStep] = React.useState<ModalStep>('loading');
    const [previewedLicense, setPreviewedLicense] = React.useState<License | null>(null);

    const currentLicense: ClientLicense = useSelector(getLicense);
    const locale = useSelector(getCurrentLocale);
    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.UPLOAD_LICENSE));

    const handleOnClose = useCallback(() => {
        if (isLoading) {
            return;
        }
        if (props.onExited) {
            props.onExited();
        }
        dispatch(closeModal(ModalIdentifiers.UPLOAD_LICENSE));
    }, [isLoading, props, dispatch]);

    // Automatically preview the license when the modal opens with a file
    useEffect(() => {
        const doPreview = async () => {
            if (!fileObj || !show) {
                return;
            }

            setIsLoading(true);
            setServerError(null);

            const {data, error} = await dispatch(previewLicense(fileObj));

            if (error || !data) {
                setServerError(error?.message ?? 'Failed to preview license');
                setIsLoading(false);
                return;
            }

            setPreviewedLicense(data);
            setIsLoading(false);
            setStep('preview');
        };

        doPreview();
    }, [fileObj, show, dispatch]);

    if (!show) {
        return null;
    }

    const handleConfirmUpload = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (fileObj === null) {
            return;
        }

        setIsLoading(true);
        const {error} = await dispatch(uploadLicense(fileObj));

        if (error) {
            setServerError(error.message);
            setIsLoading(false);
            return;
        }

        await dispatch(getLicenseConfig());
        setServerError(null);
        setIsLoading(false);
        setStep('success');
    };

    let uploadLicenseContent: JSX.Element;

    if (step === 'loading') {
        uploadLicenseContent = (
            <>
                <div className='content-body'>
                    <div className='title'>
                        <FormattedMessage
                            id='admin.license.upload-modal.loading.title'
                            defaultMessage='Validating License'
                        />
                    </div>
                    <div className='subtitle'>
                        <FormattedMessage
                            id='admin.license.upload-modal.loading.subtitle'
                            defaultMessage='Please wait while we validate your license file...'
                        />
                    </div>
                    {serverError && (
                        <div className='serverError'>
                            <i className='icon icon-alert-outline'/>
                            <span
                                className='server-error-text'
                                dangerouslySetInnerHTML={{__html: marked(serverError)}}
                            />
                        </div>
                    )}
                </div>
                <div className='content-footer'>
                    <div className='btn-upload-wrapper'>
                        {serverError ? (
                            <button
                                className='btn btn-primary'
                                onClick={handleOnClose}
                                id='close-button'
                            >
                                <FormattedMessage
                                    id='admin.license.modal.close'
                                    defaultMessage='Close'
                                />
                            </button>
                        ) : (
                            <LoadingWrapper
                                loading={true}
                                text={defineMessage({id: 'admin.license.modal.validating', defaultMessage: 'Validating'})}
                            >
                                <span/>
                            </LoadingWrapper>
                        )}
                    </div>
                </div>
            </>
        );
    } else if (step === 'preview' && previewedLicense) {
        uploadLicenseContent = (
            <>
                <div className='content-body'>
                    <div className='title'>
                        <FormattedMessage
                            id='admin.license.upload-modal.preview.title'
                            defaultMessage='Review License Changes'
                        />
                    </div>
                    <div className='subtitle'>
                        <FormattedMessage
                            id='admin.license.upload-modal.preview.subtitle'
                            defaultMessage='Please review the changes before applying the new license.'
                        />
                    </div>
                    <LicenseDiffView
                        currentLicense={currentLicense}
                        newLicense={previewedLicense}
                        locale={locale}
                    />
                    {serverError && (
                        <div className='serverError'>
                            <i className='icon icon-alert-outline'/>
                            <span
                                className='server-error-text'
                                dangerouslySetInnerHTML={{__html: marked(serverError)}}
                            />
                        </div>
                    )}
                </div>
                <div className='content-footer preview-footer'>
                    <button
                        className='btn btn-tertiary'
                        onClick={handleOnClose}
                        id='cancel-button'
                    >
                        <FormattedMessage
                            id='admin.license.modal.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        className='btn btn-primary'
                        onClick={handleConfirmUpload}
                        id='confirm-button'
                    >
                        <LoadingWrapper
                            loading={Boolean(isLoading)}
                            text={defineMessage({id: 'admin.license.modal.applying', defaultMessage: 'Applying'})}
                        >
                            <FormattedMessage
                                id='admin.license.modal.apply'
                                defaultMessage='Apply License'
                            />
                        </LoadingWrapper>
                    </button>
                </div>
            </>
        );
    } else {
        // Success step
        const startsAt = (
            <FormattedDate
                value={new Date(parseInt(currentLicense.StartsAt, 10))}
                day='2-digit'
                month={getMonthLong(locale)}
                year='numeric'
            />
        );
        const expiresAt = (
            <FormattedDate
                value={new Date(parseInt(currentLicense.ExpiresAt, 10))}
                day='2-digit'
                month={getMonthLong(locale)}
                year='numeric'
            />
        );

        const licensedUsersNum = currentLicense.Users;
        const skuName = getSkuDisplayName(currentLicense.SkuShortName, currentLicense.IsGovSku === 'true');
        uploadLicenseContent = (
            <>
                <div className='content-body'>
                    <div className='svg-image hands-svg'>
                        <SuccessSvg
                            width={162}
                            height={103.5}
                        />
                    </div>
                    <div className='title'>
                        <FormattedMessage
                            id='admin.license.upload-modal.successfulUpgrade'
                            defaultMessage='Successful Upgrade!'
                        />
                    </div>
                    <div className='subtitle'>
                        <FormattedMessage
                            id='admin.license.upload-modal.successfulUpgradeText'
                            defaultMessage='You have upgraded to the {skuName} plan for {licensedUsersNum, number} seats. This is effective from {startsAt} until {expiresAt}. '
                            values={{
                                expiresAt,
                                startsAt,
                                licensedUsersNum,
                                skuName,
                            }}
                        />
                    </div>
                </div>
                <div className='content-footer'>
                    <div className='btn-upload-wrapper'>
                        <button
                            className='btn btn-primary'
                            onClick={handleOnClose}
                            id='done-button'
                        >
                            <FormattedMessage
                                id='admin.license.modal.done'
                                defaultMessage='Done'
                            />
                        </button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <GenericModal
            className={'UploadLicenseModal'}
            show={show}
            id='UploadLicenseModal'
            compassDesign={true}
            onExited={handleOnClose}
        >
            {uploadLicenseContent}
        </GenericModal>
    );
};

export default UploadLicenseModal;
