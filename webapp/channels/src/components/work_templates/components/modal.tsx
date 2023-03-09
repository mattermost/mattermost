// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import GenericModal from 'components/generic_modal';

const Modal = styled(GenericModal)`
    width: 960px;

    .modal-body {
        min-height: 450px;
    }

    &.work-template-modal--customize, &.work-template-modal--preview {
        .modal-body {
            background: rgba(var(--denim-button-bg-rgb), 0.04);
        }
    }
`;

export default Modal;
