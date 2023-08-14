// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {FolderPlusOutlineIcon} from '@mattermost/compass-icons/components';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';

import EditCategoryModal from 'components/edit_category_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    id: string;
}

const CreateNewCategoryMenuItem = ({
    id,
}: Props) => {
    const dispatch = useDispatch();
    const handleCreateCategory = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CATEGORY,
            dialogType: EditCategoryModal,
        }));
        trackEvent('ui', 'ui_sidebar_category_menu_createCategory');
    }, [dispatch]);

    return (
        <Menu.Item
            id={`create-${id}`}
            onClick={handleCreateCategory}
            aria-haspopup={true}
            leadingElement={<FolderPlusOutlineIcon size={18}/>}
            labels={(
                <FormattedMessage
                    id='sidebar_left.sidebar_category_menu.createCategory'
                    defaultMessage='Create New Category'
                />
            )}
        />
    );
};

export default CreateNewCategoryMenuItem;
