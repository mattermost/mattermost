const initial = 'ㅈ';
const medial = 'ㅏ';
const final = 'ㄹ';

/*console.log(initial+medial+final);
console.log((initial+medial+final).normalize('NFKC'));*/

// ((initial * 588) + (medial * 28) + final) + 44032

const input = '잘';
//const input = '이'

let codePoint = input.charCodeAt(0);
console.log(codePoint);

let a = codePoint - 0xac00;
console.log(a)
const retInitial = (a - (a % 588)) / 588 + 0x1100;
console.log(retInitial, retInitial === initial.normalize('NFKC').charCodeAt(0));

const b = a % 588;
const retMedial = (b - (b % 28)) / 28 + 0x1161;
console.log(retMedial, String.fromCharCode(retMedial), retMedial === medial.normalize('NFKC').charCodeAt(0));

const c = a % 28;
console.log('c', c);
const retFinal = c + 0x11a7;
console.log(retFinal, String.fromCharCode(retFinal), final.charCodeAt(0), final, String.fromCharCode(retFinal).normalize('NFKC') === final.normalize('NFKC'));
