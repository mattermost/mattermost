// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import SetupSystemSvg from 'components/common/svg_images_components/setup_system';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import {format} from 'utils/markdown';

interface TeamEditionRightPanelProps {
    upgradingPercentage: number;
    handleUpgrade: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
    upgradeError: string | null;
    restartError: string | null;

    handleRestart: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void>;

    setClickNormalUpgradeBtn: () => void;

    openEEModal: () => void;

    restarting: boolean;
}

const TeamEditionRightPanel: React.FC<TeamEditionRightPanelProps> = ({
    upgradingPercentage,
    handleUpgrade,
    upgradeError,
    restartError,
    handleRestart,
    restarting,
    openEEModal,
    setClickNormalUpgradeBtn,
}: TeamEditionRightPanelProps) => {
    let upgradeButton = null;
    const intl = useIntl();

    const onHandleUpgrade = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!handleUpgrade) {
            return;
        }
        setClickNormalUpgradeBtn();
        handleUpgrade(e);
    };
    const upgradeAdvantages = [
        'AD/LDAP Group Sync',
        'High Availability',
        'Advanced compliance',
        'And more...',
    ];
    if (upgradingPercentage !== 100) {
        upgradeButton = (
            <div>
                <p>
                    <button
                        type='button'
                        onClick={onHandleUpgrade}
                        className='btn btn-primary'
                    >
                        <LoadingWrapper
                            loading={upgradingPercentage > 0}
                            text={
                                <FormattedMessage
                                    id='admin.license.enterprise.upgrading'
                                    defaultMessage='Upgrading {percentage}%'
                                    values={{percentage: upgradingPercentage}}
                                />
                            }
                        >
                            <FormattedMessage
                                id='admin.license.enterprise.upgrade'
                                defaultMessage='Upgrade to Enterprise Edition'
                            />
                        </LoadingWrapper>
                    </button>
                </p>
                <p className='upgrade-legal-terms'>
                    <FormattedMessage
                        id='admin.licenseSettings.teamEdition.teamEditionRightPanel.acceptTermsInitial'
                        defaultMessage='By clicking <b>Upgrade</b>, I agree to the terms of the Mattermost '
                        values={{
                            b: (chunks: string) => <b>{chunks}</b>,
                        }}
                    />
                    <a
                        role='button'
                        onClick={openEEModal}
                    >
                        <FormattedMessage
                            id='admin.licenseSettings.teamEdition.teamEditionRightPanel.eeLicenseLink'
                            defaultMessage='Enterprise Edition License'
                        />
                    </a>
                    <FormattedMessage
                        id='admin.licenseSettings.teamEdition.teamEditionRightPanel.acceptTermsFinal'
                        defaultMessage='. Upgrading will download the binary and update your team edition.'
                    />
                </p>
                {upgradeError && (
                    <div className='upgrade-error'>
                        <div className='form-group has-error'>
                            <div
                                className='as-bs-label control-label'
                                dangerouslySetInnerHTML={{
                                    __html: format(upgradeError),
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    } else if (upgradingPercentage === 100) {
        upgradeButton = (
            <div>
                <p>
                    <FormattedMessage
                        id='admin.licenseSettings.teamEdition.teamEditionRightPanel.upgradedRestart'
                        defaultMessage='You have upgraded your binary to mattermost enterprise, please restart the server to start using the new binary. You can do it right here:'
                    />
                </p>
                <p>
                    <button
                        type='button'
                        onClick={handleRestart}
                        className='btn btn-primary'
                    >
                        <LoadingWrapper
                            loading={restarting}
                            text={intl.formatMessage({
                                id: 'admin.licenseSettings.teamEdition.teamEditionRightPanel.restarting',
                                defaultMessage: 'Restarting',
                            })}
                        >
                            <FormattedMessage
                                id='admin.licenseSettings.teamEdition.teamEditionRightPanel.restart'
                                defaultMessage='Restart Server'
                            />
                        </LoadingWrapper>
                    </button>
                </p>
                {restartError && (
                    <div className='upgrade-error'>
                        <div className='form-group has-error'>
                            <div className='as-bs-label control-label'>
                                {restartError}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className='TeamEditionRightPanel'>
            <div className='svg-image'>
                <SetupSystemSvg
                    width={197}
                    height={120}
                />
            </div>
            <div className='upgrade-title'>
                <FormattedMessage
                    id='admin.license.enterprise.upgrade'
                    defaultMessage='Upgrade to Enterprise Edition'
                />
            </div>
            <div className='upgrade-subtitle'>
                <FormattedMessage
                    id='admin.license.enterprise.license_required_upgrade'
                    defaultMessage='A license is required to unlock enterprise features'
                />
            </div>
            <div className='advantages-list'>
                {upgradeAdvantages.map((item: string, i: number) => {
                    return (
                        <div
                            className='item'
                            key={i.toString()}
                        >
                            <i className='fa fa-lock'/>{item}
                        </div>
                    );
                })}
            </div>
            {upgradeButton}
        </div>
    );
};

export default React.memo(TeamEditionRightPanel);
