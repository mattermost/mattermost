import React from 'react';

export function openModal(m: {modalId: string; dialogType: unknown; dialogProps?: Record<string, unknown>}) {
    return {type: 'OPEN', m};
}

export function SettingsModal({onSave}: {onSave?: () => void}) {
    return (
        <div role='dialog'>
            <button
                data-testid='settings_modal.save--button'
                onClick={onSave}
            />
        </div>
    );
}

export function LeaveModal() {
    return <button data-testid='leave_modal.confirm--button'/>;
}

export function InfoPopover() {
    return <span data-testid='info_popover.body--text'/>;
}

// a modal opener component: clicking it opens dialogType
export function ToggleModalButton(props: {dialogType: unknown; dialogProps?: unknown; children?: any; 'data-testid'?: string}) {
    return (
        <button
            {...props}
            onClick={() => openModal({modalId: 'x', dialogType: props.dialogType})}
        />
    );
}

// the app's shape: a typed testId renders the component's own button, and dialogType stays on the usage
export function TestIdToggleModalButton({dialogType, testId}: {dialogType: unknown; testId?: string}) {
    const show = () => openModal({modalId: 'y', dialogType});
    return (
        <button
            onClick={show}
            data-testid={testId ? `${testId}--button` : undefined}
        />
    );
}

// lazily loaded modal
export const LazyModal = React.lazy(() => import('./lazy_modal'));

// shared Button shape: a typed testId prop renders `${testId}--button`, else a passed data-testid
export const SharedButton = React.forwardRef(({testId, ...otherProps}: {testId?: string; 'data-testid'?: string; onClick?: () => void; children?: any}) => (
    <button
        {...otherProps}
        data-testid={testId ? `${testId}--button` : (otherProps as {'data-testid'?: string})['data-testid']}
    />
));

export function Footer() {
    return (
        <div>
            <SharedButton testId='footer.save'/>
            <SharedButton data-testid='footer.cancel--button'/>
        </div>
    );
}

// a modal named by its own scope, though a nested component's scope occurs more often in its tree
function MentionPopover() {
    return (
        <>
            <span data-testid='mention_popover.name--text'/>
            <span data-testid='mention_popover.actions'/>
        </>
    );
}
export function NoteModal() {
    return (
        <div data-testid='note_modal'>
            <button data-testid='note_modal.save--button'/>
            <MentionPopover/>
        </div>
    );
}
export function NoteOpener() {
    return (
        <button
            data-testid='footer.note--button'
            onClick={() => openModal({modalId: 'note', dialogType: NoteModal})}
        />
    );
}

// one small component mounted under two different owners: the shared class is named after it, not after either owner
function CopyIcon({testId}: {testId: string}) {
    return <button data-testid={`${testId}.copy--button`}/>;
}
export function TokenRow() {
    return (
        <span data-testid='footer.token'>
            <CopyIcon testId='footer.token'/>
        </span>
    );
}
export function UrlRow() {
    return (
        <span data-testid='banner.url'>
            <CopyIcon testId='banner.url'/>
        </span>
    );
}

// one generic dialog rendered at two places with its own testid each
function ConfirmModal({testId, onConfirm}: {testId: string; onConfirm: () => void}) {
    return (
        <div
            role='dialog'
            data-testid={testId}
        >
            <button
                data-testid={`${testId}.confirm--button`}
                onClick={onConfirm}
            />
        </div>
    );
}

// a save that opens one of the two (the request is refused, or it needs confirming): both are opened, each with its scope
export function SaveBar({refused}: {refused: boolean}) {
    const [showRefused, setShowRefused] = React.useState(false);
    const [showConfirm, setShowConfirm] = React.useState(false);
    return (
        <div>
            <button
                data-testid='save_bar.save--button'
                onClick={() => (refused ? setShowRefused(true) : setShowConfirm(true))}
            />
            {showRefused && (
                <ConfirmModal
                    testId='save_bar.refused_modal'
                    onConfirm={() => setShowRefused(false)}
                />
            )}
            {showConfirm && (
                <ConfirmModal
                    testId='save_bar.confirm_modal'
                    onConfirm={() => setShowConfirm(false)}
                />
            )}
        </div>
    );
}
