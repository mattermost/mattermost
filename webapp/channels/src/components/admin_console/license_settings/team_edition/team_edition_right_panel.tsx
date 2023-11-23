// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import WomanUpArrowsAndCloudsSvg from 'components/common/svg_images_components/woman_up_arrows_and_clouds_svg';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import {format} from 'utils/markdown';
import {localizeMessage} from 'utils/utils';

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
                    <FormattedMarkdownMessage
                        id='admin.license.enterprise.upgrade.acceptTermsInitial'
                        defaultMessage='By clicking **Upgrade**, I agree to the terms of the Mattermost '
                    />
                    <a
                        role='button'
                        onClick={openEEModal}
                    >
                        <FormattedMarkdownMessage
                            id='admin.license.enterprise.upgrade.eeLicenseLink'
                            defaultMessage='Enterprise Edition License'
                        />
                    </a>
                    <FormattedMarkdownMessage
                        id='admin.license.enterprise.upgrade.acceptTermsFinal'
                        defaultMessage='. Upgrading will download the binary and update your team edition.'
                    />
                </p>
                {upgradeError && (
                    <div className='upgrade-error'>
                        <div className='form-group has-error'>
                            <label className='control-label'>
                                <span
                                    dangerouslySetInnerHTML={{
                                        __html: format(upgradeError),
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                )}
            </div>
        );
    } else if (upgradingPercentage === 100) {
        upgradeButton = (
            <div>
                <p>
                    <FormattedMarkdownMessage
                        id='admin.license.upgraded-restart'
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
                            text={localizeMessage(
                                'admin.license.enterprise.restarting',
                                'Restarting',
                            )}
                        >
                            <FormattedMessage
                                id='admin.license.enterprise.restart'
                                defaultMessage='Restart Server'
                            />
                        </LoadingWrapper>
                        {restartError && (
                            <div className='col-sm-12'>
                                <div className='form-group has-error'>
                                    <label className='control-label'>
                                        {restartError}
                                    </label>
                                </div>
                            </div>
                        )}
                    </button>
                </p>
            </div>
        );
    }

    return (
        <div className='TeamEditionRightPanel'>
            <div className='svg-image'>
                <WomanUpArrowsAndCloudsSvg
                    width={200}
                    height={200}
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
