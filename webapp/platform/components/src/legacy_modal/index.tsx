// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, ReactElement} from 'react'
import { Modal, ModalProps } from 'react-bootstrap'

import { FocusTrap } from '../focus_trap'

/**
 * This is a wrapper around the react-bootstrap Modal component that adds
 * focus trap functionality. It is intended to be used in place of the
 * react-bootstrap Modal component directly.
 * Do not use this component for new modals. Use the GenericModal component instead
 */
export function LegacyModal({ children, ...props }: ModalProps) {
  const [isFocusTrapActive, setFocusTrap] = useState(false)

  function handleEntered() {
    setFocusTrap(true)
  }

  if (!children) {
    return null
  }

  return (
    <Modal 
        {...props} 
        enforceFocus={false} 
        onEntered={handleEntered}
    >
      <FocusTrap active={isFocusTrapActive}>
        {children as ReactElement}
      </FocusTrap>
    </Modal>
  )
}
