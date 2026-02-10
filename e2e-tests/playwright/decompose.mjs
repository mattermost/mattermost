function decomposeHangul(input) {
    // Math adapted from https://useless-factor.blogspot.com/2007/08/unicode-implementers-guide-part-3.html

    const codePoint = input.charCodeAt(0);

    // codePoint = ((initial-0x1100) * 588) + ((medial-0x1161) * 28) + (final-0x11a7) + 0xac00
    // codePoint = (a * 588) + (b * 28) + (c) + 0xac00
    const n = codePoint - 0xac00;
    const a = (n - (n % 588)) / 588;
    const b = ((n % 588) - ((n % 588) % 28)) / 28;
    const c = n % 28;

    const initial = String.fromCodePoint(a + 0x1100);
    const medial = String.fromCodePoint(b + 0x1161);
    const final = c > 0 ? String.fromCodePoint(c + 0x11a7) : '';

    console.log(input, initial, medial, final);
}


'한글이'.split('').forEach(decomposeHangul);
