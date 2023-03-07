// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

import FullScreenModal from './full_screen_modal';

describe('components/widgets/modals/FullScreenModal', () => {
    test('showing content', () => {
        const wrapper = shallowWithIntl(
            <FullScreenModal
                show={true}
                onClose={jest.fn()}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(wrapper).toMatchInlineSnapshot(`
<CSSTransition
  appear={true}
  classNames="FullScreenModal"
  in={true}
  mountOnEnter={true}
  timeout={100}
  unmountOnExit={true}
>
  <div
    aria-label="test"
    aria-modal={true}
    className="FullScreenModal"
    role="dialog"
    tabIndex={-1}
  >
    <button
      aria-label="Close"
      className="close-x"
      onClick={[Function]}
    >
      <CloseIcon
        id="closeIcon"
      />
    </button>
    test
  </div>
  <div
    style={
      Object {
        "display": "none",
      }
    }
    tabIndex={0}
  />
</CSSTransition>
`);
    });
    test('not showing content', () => {
        const wrapper = shallowWithIntl(
            <FullScreenModal
                show={false}
                onClose={jest.fn()}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(wrapper).toMatchInlineSnapshot(`
<CSSTransition
  appear={true}
  classNames="FullScreenModal"
  in={false}
  mountOnEnter={true}
  timeout={100}
  unmountOnExit={true}
>
  <div
    aria-label="test"
    aria-modal={true}
    className="FullScreenModal"
    role="dialog"
    tabIndex={-1}
  >
    <button
      aria-label="Close"
      className="close-x"
      onClick={[Function]}
    >
      <CloseIcon
        id="closeIcon"
      />
    </button>
    test
  </div>
  <div
    style={
      Object {
        "display": "none",
      }
    }
    tabIndex={0}
  />
</CSSTransition>
`);
    });
    test('with back icon', () => {
        const wrapper = shallowWithIntl(
            <FullScreenModal
                show={true}
                onClose={jest.fn()}
                onGoBack={jest.fn()}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(wrapper).toMatchInlineSnapshot(`
<CSSTransition
  appear={true}
  classNames="FullScreenModal"
  in={true}
  mountOnEnter={true}
  timeout={100}
  unmountOnExit={true}
>
  <div
    aria-label="test"
    aria-modal={true}
    className="FullScreenModal"
    role="dialog"
    tabIndex={-1}
  >
    <button
      aria-label="Back"
      className="back"
      onClick={[MockFunction]}
    >
      <BackIcon
        id="backIcon"
      />
    </button>
    <button
      aria-label="Close"
      className="close-x"
      onClick={[Function]}
    >
      <CloseIcon
        id="closeIcon"
      />
    </button>
    test
  </div>
  <div
    style={
      Object {
        "display": "none",
      }
    }
    tabIndex={0}
  />
</CSSTransition>
`);
    });

    test('close on close icon click', () => {
        const close = jest.fn();
        const wrapper = shallowWithIntl(
            <FullScreenModal
                show={true}
                onClose={close}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(close).not.toBeCalled();
        wrapper.find('button.close-x').simulate('click');
        expect(close).toBeCalled();
    });

    test('go back on back icon click', () => {
        const back = jest.fn();
        const wrapper = shallowWithIntl(
            <FullScreenModal
                show={true}
                onClose={jest.fn()}
                onGoBack={back}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(back).not.toBeCalled();
        wrapper.find('button.back').simulate('click');
        expect(back).toBeCalled();
    });

    test('close on esc keypress', () => {
        const close = jest.fn();
        shallowWithIntl(
            <FullScreenModal
                show={true}
                onClose={close}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(close).not.toBeCalled();
        const event = new KeyboardEvent('keydown', {key: 'Escape'});
        document.dispatchEvent(event);
        expect(close).toBeCalled();
    });
});
