// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {openModal} from 'actions/views/modals';

import {renderHookWithContext, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import AttributeGraphGrantConfirmModal, {useGrantConfirm} from './attribute_graph_grant_confirm_modal';
import type {GrantConfirmRequest} from './attribute_graph_grant_confirm_modal';


jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCK_OPEN_MODAL'})),
}));

const displayProps = {
    parentName: 'Operation Aurora',
    childName: 'Raptor Flight',
    newlyReachable: ['Mission Casper'],
    ancestorsOfParent: ['Joint Command'],
};

const grantReq: GrantConfirmRequest = {
    parentName: 'Operation Aurora',
    childName: 'Raptor Flight',
    newlyReachable: ['Mission Casper'],
    ancestorsOfParent: ['Joint Command'],
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

    it('renders locked grant-framed chrome', () => {
        renderModal();

        expect(screen.getByRole('heading', {name: 'Confirm this grant'})).toBeInTheDocument();
        expect(screen.getByText('Operation Aurora → Raptor Flight')).toBeInTheDocument();
        expect(screen.getByText('Adding this means everyone who holds "Operation Aurora" can reach every channel marked "Raptor Flight".')).toBeInTheDocument();
        expect(screen.getByText('Anyone holding "Operation Aurora" also gets "Raptor Flight".')).toBeInTheDocument();
        expect(screen.getByText('1 value becomes newly reachable')).toBeInTheDocument();

        const list = screen.getByTestId('attributeGraphGrantConfirm__newlyReachable');
        expect(list).toHaveTextContent('Mission Casper');
        expect(list).not.toHaveTextContent('Raptor Flight');

        expect(screen.getByRole('button', {name: /^add the parent$/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
    });

    it('uses the plural newly-reachable title for N values', () => {
        renderModal({newlyReachable: ['Mission Casper', 'Talon Flight']});

        expect(screen.getByText('2 values become newly reachable')).toBeInTheDocument();
        const list = screen.getByTestId('attributeGraphGrantConfirm__newlyReachable');
        expect(list).toHaveTextContent('Mission Casper');
        expect(list).toHaveTextContent('Talon Flight');
    });

    it('lists named descendants rather than a count-only body', () => {
        renderModal({newlyReachable: ['Mission Casper', 'Talon Flight']});

        const items = screen.getAllByRole('listitem');
        expect(items.map((item) => item.textContent)).toEqual(['Mission Casper', 'Talon Flight']);
    });

    it('shows the ancestor hint when ancestorsOfParent is non-empty', () => {
        renderModal();

        expect(screen.getByTestId('attributeGraphGrantConfirm__ancestorHint')).toHaveTextContent(
            'Everything above "Operation Aurora" inherits the same reach: "Joint Command".',
        );
    });

    it('joins multiple ancestors with oxfordJoinNames', () => {
        renderModal({ancestorsOfParent: ['Joint Command', 'Fleet']});

        expect(screen.getByTestId('attributeGraphGrantConfirm__ancestorHint')).toHaveTextContent(
            'Everything above "Operation Aurora" inherits the same reach: "Joint Command" and "Fleet".',
        );
    });

    it('omits the ancestor hint when ancestorsOfParent is empty', () => {
        renderModal({ancestorsOfParent: []});

        expect(screen.queryByTestId('attributeGraphGrantConfirm__ancestorHint')).not.toBeInTheDocument();
        expect(screen.queryByText(/inherits the same reach/i)).not.toBeInTheDocument();
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

        const confirm = screen.getByRole('button', {name: /^add the parent$/i});
        expect(confirm).toHaveClass('confirm');
        expect(confirm).not.toHaveClass('delete');
    });

    it('invokes onConfirm when Add the parent is clicked', async () => {
        const props = renderModal();

        await userEvent.click(screen.getByRole('button', {name: /^add the parent$/i}));

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
                newlyReachable: ['Mission Casper'],
                ancestorsOfParent: ['Joint Command'],
                onConfirm: expect.any(Function),
                onCancel: expect.any(Function),
                onExited: expect.any(Function),
            },
        });
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
