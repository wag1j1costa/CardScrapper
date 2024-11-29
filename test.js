let cardName = ['O Grande Círculo'];
function splitString(str) {
    // Expressão regular para separar o texto por "/" com um espaço antes e depois e não seguido por outro "/"
    const regex = /\s\/\s(?!\/)/;

    // Dividir a string usando a expressão regular
    const parts = str.split(regex);

    return parts;
}
let cardNameParts = cardName[0].split(/\/\s*/);
let cardNameScryfall = cardNameParts[1] ?? cardNameParts[0];
console.log(splitString(cardName[0]));