import React, {useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Banner} from 'src/components/backstage/styles';

import ConfirmModal from 'src/components/widgets/confirmation_modal';

import {Playbook} from 'src/types/playbook';

import {useLHSRefresh} from './lhs_navigation';

const RestoreBannerTimeout = 5000;

type Props = {id: string; title: string};

const useConfirmPlaybookRestoreModal = (restorePlaybook: (id: Playbook['id']) => void) : [React.ReactNode, (context: Props, callback?: () => void) => void] => {
    const {formatMessage} = useIntl();
    const [open, setOpen] = useState(false);
    const cbRef = useRef<() => void>();
    const [showBanner, setShowBanner] = useState(false);
    const [context, setContext] = useState<Props | null>(null);
    const refreshLHS = useLHSRefresh();

    const openModal = (targetContext: Props, callback?: () => void) => {
        setContext(targetContext);
        setOpen(true);
        cbRef.current = callback;
    };

    async function onRestore() {
        if (context) {
            await restorePlaybook(context.id);
            refreshLHS();

            setOpen(false);
            setShowBanner(true);
            cbRef.current?.();

            window.setTimeout(() => {
                setShowBanner(false);
            }, RestoreBannerTimeout);
        }
    }

    const modal = (
        <>
            <ConfirmModal
                show={open}
                onConfirm={onRestore}
                onCancel={() => setOpen(false)}
                title={formatMessage({defaultMessage: 'Restore playbook'})}
                message={formatMessage({defaultMessage: 'Are you sure you want to restore the playbook {title}?'}, {title: context?.title})}
                confirmButtonText={formatMessage({defaultMessage: 'Restore'})}

            />
            {showBanner &&
                <Banner>
                    <i className='icon icon-check mr-1'/>
                    <FormattedMessage
                        defaultMessage='The playbook {title} was successfully restored.'
                        values={{title: context?.title}}
                    />
                </Banner>
            }
        </>
    );

    return [modal, openModal];
};

export default useConfirmPlaybookRestoreModal;
