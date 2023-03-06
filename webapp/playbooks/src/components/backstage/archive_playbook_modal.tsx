import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Banner} from 'src/components/backstage/styles';
import {Playbook} from 'src/types/playbook';

import ConfirmModal from 'src/components/widgets/confirmation_modal';

import {useLHSRefresh} from './lhs_navigation';

const ArchiveBannerTimeout = 5000;

interface ArchiveModalParams {
    id: string
    title: string
}

const useConfirmPlaybookArchiveModal = (archivePlaybook: (id: Playbook['id']) => void): [React.ReactNode, (pb: ArchiveModalParams) => void] => {
    const {formatMessage} = useIntl();
    const [open, setOpen] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const [playbook, setPlaybook] = useState<ArchiveModalParams | null>(null);
    const refreshLHS = useLHSRefresh();

    const openModal = (playbookToOpenWith: ArchiveModalParams) => {
        setPlaybook(playbookToOpenWith);
        setOpen(true);
    };

    const onArchive = async () => {
        if (playbook) {
            await archivePlaybook(playbook.id);
            refreshLHS();

            setOpen(false);
            setShowBanner(true);

            window.setTimeout(() => {
                setShowBanner(false);
            }, ArchiveBannerTimeout);
        }
    };

    const modal = (
        <>
            <ConfirmModal
                show={open}
                title={formatMessage({defaultMessage: 'Archive playbook'})}
                message={formatMessage({defaultMessage: 'Are you sure you want to archive the playbook {title}?'}, {title: playbook?.title})}
                confirmButtonText={formatMessage({defaultMessage: 'Archive'})}
                onConfirm={onArchive}
                onCancel={() => setOpen(false)}
            />
            {showBanner &&
            <Banner>
                <i className='icon icon-check mr-1'/>
                <FormattedMessage
                    defaultMessage='The playbook {title} was successfully archived.'
                    values={{title: playbook?.title}}
                />
            </Banner>
            }
        </>
    );

    return [modal, openModal];
};

export default useConfirmPlaybookArchiveModal;
