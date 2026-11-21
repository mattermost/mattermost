import React from 'react';

export function Dupes({mode, id}: {mode: boolean; id?: string}) {
    if (mode) {
        return <button data-testid='checks.panel.ok--button'/>;
    }
    return (
        <div>
            {mode ? <button data-testid='checks.panel.go--button'/> : <a data-testid='checks.panel.go--button' href='#'/>}
            <span data-testid='checks.panel.ok--button'/>
            <span data-testid='checks.panel.twice--text'/>
            <span data-testid='checks.panel.twice--text'/>
            <span data-testid='checks.shared.label--text'/>
            <div data-testid='checks.panel.save--button'/>
            <div data-testid='checks.panel.state--checkbox'/>
            <button data-testid='checks.panel.plain'/>
            <div
                role='main'
                data-testid='checks.panel.content'
            />
            <div
                data-testid='checks.panel.clickable'
                onClick={() => null}
            />
            <span data-testid={`checks.panel.item_${id}--text`}/>
            <span data-testid={id}/>
            <span data-testid='LegacyName'/>
        </div>
    );
}

export function Form() {
    return (
        <form>
            <input data-testid='checks.form.name--textbox'/>
            <input
                type='checkbox'
                data-testid='checks.form.agree--checkbox'
            />
            <button
                role='switch'
                aria-checked={true}
                data-testid='checks.form.notify--switch'
            />
        </form>
    );
}

// one variable assigned under contradicting guards: only one icon renders
export function Thumb({compact, archived}: {compact: boolean; archived: boolean}) {
    let icon = null;
    if (!compact) {
        icon = <span data-testid='checks.thumb.icon--text'/>;
    }
    if (archived && compact) {
        icon = <span data-testid='checks.thumb.icon--text'/>;
    }
    return <div>{icon}</div>;
}

// render helpers chosen by an if/else-if return chain: only one intro renders
function directIntro() {
    return <div data-testid='checks.intro'/>;
}

function groupIntro() {
    return <div data-testid='checks.intro'/>;
}

export function Intro({kind}: {kind: string}) {
    if (kind === 'D') {
        return directIntro();
    } else if (kind === 'G') {
        return groupIntro();
    }
    return null;
}

// two render helpers that both run: both items render
function firstItem() {
    return <span data-testid='checks.pair.item--text'/>;
}

function secondItem() {
    return <span data-testid='checks.pair.item--text'/>;
}

export function Pair() {
    return <div>{firstItem()}{secondItem()}</div>;
}

// an input whose usage testid reaches the field by spread, beside a clear button that renders none without its own prop
function ClearableInput({clearTestId, ...rest}: {clearTestId?: string; 'data-testid'?: string}) {
    return (
        <div>
            <input {...rest}/>
            <button data-testid={clearTestId ? `${clearTestId}--button` : undefined}/>
        </div>
    );
}

export function SearchForm() {
    return <ClearableInput data-testid='checks.form.search--textbox'/>;
}

// a rich-text editor: the editable root is a textbox; a token chip inside it (`contentEditable={false}`) is not
export function TokenEditor() {
    return (
        <div
            contentEditable={true}
            data-testid='checks.editor--textbox'
        >
            <span
                contentEditable={false}
                data-testid='checks.editor.token'
            />
        </div>
    );
}

// a testid passed only when there is a scope (`{...(scope ? {'data-testid': …} : {})}`) never renders "undefined"
function GuardedLabel({scope}: {scope?: string}) {
    return <span {...(scope ? {'data-testid': `${scope}.guarded--text`} : {})}/>;
}
export function GuardedLabels() {
    return (
        <div>
            <GuardedLabel scope='checks.spread'/>
            <GuardedLabel/>
        </div>
    );
}

// a testid forwarded to a component the scan can't see into (one picked at run time): one element, not two
declare function pickIcon(kind: string): React.ComponentType<{'data-testid'?: string}>;
function KindIcon({kind, 'data-testid': testId}: {kind: string; 'data-testid'?: string}) {
    const Icon = pickIcon(kind);
    return <Icon data-testid={testId}/>;
}
export function IconRow() {
    return (
        <KindIcon
            kind='lock'
            data-testid='checks.icon_row.icon'
        />
    );
}

// …also when forwarded only if set (`{...(testId !== undefined && {'data-testid': testId})}`, keeping the icon's own default)
function KindIconSpread({kind, 'data-testid': testId}: {kind: string; 'data-testid'?: string}) {
    const Icon = pickIcon(kind);
    return <Icon {...(testId !== undefined && {'data-testid': testId})}/>;
}
export function IconRowSpread() {
    return (
        <KindIconSpread
            kind='lock'
            data-testid='checks.icon_row.spread_icon'
        />
    );
}

// a bare word is a scope root on a container a popup renders into (a menu, like a dialog), not on a control
export function PopupRoots() {
    return (
        <div>
            <ul
                role='menu'
                data-testid='checks_popup'
            />
            <button data-testid='checks_control'/>
        </div>
    );
}
