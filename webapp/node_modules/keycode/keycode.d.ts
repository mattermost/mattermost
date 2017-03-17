declare interface CodesMap {
  [key: string]: number;
}

declare interface InverseCodesMap {
  [key: number]: string;
}

declare interface Keycode {
  (event: Event): string;
  (keycode: number): string;
  (name: string): number;
  codes: CodesMap;
  aliases: CodesMap;
  names: InverseCodesMap;
}

declare var keycode: Keycode;

export = keycode;
