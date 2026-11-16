// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {openModal} from 'actions/views/modals';

import {renderHookWithContext, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import AttributeGraphGrantConfirmModal, {useGrantConfirm} from './grant_confirm_modal';
import type {GrantConfirmRequest} from './parent_ops';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCK_OPEN_MODAL'})),
}));

const displayProps = {
    parentName: 'Operation Aurora',
    childName: 'Raptor Flight',
};

const grantReq: GrantConfirmRequest = {
    parentName: 'Operation Aurora',
    childName: 'Raptor Flight',
    newlyReachable: ['Mission Casper'],
};

describe('AttributeGraphGrantConfirmModal', () => {
    const renderModal = (overrides: Partial<React.ComponentProps<typeof AttributeGraphGrantConfirmModal>> = {}) => {
        const props = {
            ...displayProps,
            onConfirm: jest.fn(),
            onCancel: jest.fn(),
            onExited: jest.fn(),
            ...overrides,
        };
        renderWithContext(<AttributeGraphGrantConfirmModal {...props}/>);
        return props;
    };

    it('renders the grant-confirm prototype chrome', () => {
        renderModal();

        expect(screen.getByRole('heading', {name: 'Add Operation Aurora as a parent?'})).toBeInTheDocument();
        expect(screen.getByText((_, element) => (
            element?.tagName === 'P' &&
            element.textContent === 'Raptor Flight and all of its child values will also sit under Operation Aurora. Are you sure you want to add this parent?'
        ))).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /^add$/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();

        expect(screen.queryByText('Operation Aurora → Raptor Flight')).not.toBeInTheDocument();
        expect(screen.queryByText('Confirm this grant')).not.toBeInTheDocument();
        expect(screen.queryByText('Add the parent')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeGraphGrantConfirm__newlyReachable')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeGraphGrantConfirm__ancestorHint')).not.toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('omits parent-framed and create-only copy', () => {
        renderModal();

        expect(screen.queryByText(/channels and users carry/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/checked again the moment you confirm/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/confirm this parent/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/now sit under this parent/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/also picks this up/i)).not.toBeInTheDocument();
    });

    it('keeps the primary button non-destructive', () => {
        renderModal();

        const confirm = screen.getByRole('button', {name: /^add$/i});
        expect(confirm).toHaveClass('confirm');
        expect(confirm).not.toHaveClass('delete');
        expect(confirm).not.toHaveClass('btn-danger');
    });

    it('invokes onConfirm when Add is clicked', async () => {
        const props = renderModal();

        await userEvent.click(screen.getByRole('button', {name: /^add$/i}));

        expect(props.onConfirm).toHaveBeenCalledTimes(1);
        expect(props.onCancel).not.toHaveBeenCalled();
    });

    it('invokes onCancel when Cancel is clicked', async () => {
        const props = renderModal();

        await userEvent.click(screen.getByRole('button', {name: /cancel/i}));

        expect(props.onCancel).toHaveBeenCalledTimes(1);
        expect(props.onConfirm).not.toHaveBeenCalled();
    });
});

describe('useGrantConfirm', () => {
    beforeEach(() => {
        (openModal as jest.Mock).mockReset();
        (openModal as jest.Mock).mockReturnValue({type: 'MOCK_OPEN_MODAL'});
    });

    it('opens GRAPH_GRANT_CONFIRM with the request and settle callbacks', () => {
        const {result} = renderHookWithContext(() => useGrantConfirm());

        result.current(grantReq);

        expect(openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.GRAPH_GRANT_CONFIRM,
            dialogType: AttributeGraphGrantConfirmModal,
            dialogProps: {
                parentName: 'Operation Aurora',
                childName: 'Raptor Flight',
                onConfirm: expect.any(Function),
                onCancel: expect.any(Function),
                onExited: expect.any(Function),
            },
        });
        expect((openModal as jest.Mock).mock.calls[0][0].dialogProps).not.toHaveProperty('ancestorsOfParent');
        expect((openModal as jest.Mock).mock.calls[0][0].dialogProps).not.toHaveProperty('newlyReachable');
    });

    it('does not open the modal when newlyReachable is empty and resolves true', async () => {
        const {result} = renderHookWithContext(() => useGrantConfirm());

        const promise = result.current({
            ...grantReq,
            newlyReachable: [],
        });

        expect(openModal).not.toHaveBeenCalled();
        await expect(promise).resolves.toBe(true);
    });

    it('resolves true when onConfirm is called', async () => {
        const {result} = renderHookWithContext(() => useGrantConfirm());

        (openModal as jest.Mock).mockImplementationOnce(({dialogProps}) => {
            dialogProps.onConfirm();
            return {type: 'MOCK_OPEN_MODAL'};
        });

        const promise = result.current(grantReq);

        await expect(promise).resolves.toBe(true);
    });

    it('resolves false when onCancel is called', async () => {
        const {result} = renderHookWithContext(() => useGrantConfirm());

        (openModal as jest.Mock).mockImplementationOnce(({dialogProps}) => {
            dialogProps.onCancel();
            return {type: 'MOCK_OPEN_MODAL'};
        });

        const promise = result.current(grantReq);

        await expect(promise).resolves.toBe(false);
    });

    it('resolves false when onExited is called', async () => {
        const {result} = renderHookWithContext(() => useGrantConfirm());

        (openModal as jest.Mock).mockImplementationOnce(({dialogProps}) => {
            dialogProps.onExited();
            return {type: 'MOCK_OPEN_MODAL'};
        });

        const promise = result.current(grantReq);

        await expect(promise).resolves.toBe(false);
    });

    it('keeps true when onConfirm is followed by onExited', async () => {
        const {result} = renderHookWithContext(() => useGrantConfirm());

        (openModal as jest.Mock).mockImplementationOnce(({dialogProps}) => {
            dialogProps.onConfirm();
            dialogProps.onExited();
            return {type: 'MOCK_OPEN_MODAL'};
        });

        const promise = result.current(grantReq);

        await expect(promise).resolves.toBe(true);
    });
});
