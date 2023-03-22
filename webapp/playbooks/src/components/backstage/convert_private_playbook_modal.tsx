import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {useEditPlaybook} from 'src/hooks';
import {PlaybookWithChecklist} from 'src/types/playbook';

type ConfirmPlaybookConvertPrivateReturn = [React.ReactNode, (show: boolean) => void];
type Props = {
    playbookId: string,
    refetch?: () => void | undefined,
    updater?: (update: Partial<PlaybookWithChecklist>) => void,
}

const useConfirmPlaybookConvertPrivateModal = ({playbookId, refetch, updater}: Props): ConfirmPlaybookConvertPrivateReturn => {
    const {formatMessage} = useIntl();
    const [showMakePrivateConfirm, setShowMakePrivateConfirm] = useState(false);
    const [playbook, updatePlaybook] = useEditPlaybook(playbookId, refetch);

    const modal = (
        <ConfirmModal
            show={showMakePrivateConfirm}
            title={formatMessage({defaultMessage: 'Convert to Private playbook'})}
            message={formatMessage({defaultMessage: 'When you convert to a private playbook, membership and run history is preserved. This change is permanent and cannot be undone. Are you sure you want to convert {playbookTitle} to a private playbook?'}, {playbookTitle: playbook?.title})}
            confirmButtonText={formatMessage({defaultMessage: 'Confirm'})}
            onConfirm={() => {
                if (playbookId && updater) {
                    updater({public: false});
                } else if (playbookId) {
                    updatePlaybook({public: false});
                }
                setShowMakePrivateConfirm(false);
            }}
            onCancel={() => setShowMakePrivateConfirm(false)}
        />
    );
    return [modal, setShowMakePrivateConfirm];
};

export default useConfirmPlaybookConvertPrivateModal;
