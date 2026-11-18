import {Dupes} from './a';

export function Other({name}: {name: string}) {
    return (
        <div>
            <span data-testid='checks.shared.label--text'/>
            <Dupes mode={false}/>
            <Dupes
                mode={false}
                id={name}
            />
            <Dupes mode={true}/>
        </div>
    );
}
