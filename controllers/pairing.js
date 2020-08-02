exports = module.exports = generateRandomPair;

function generateRandomPair(decks, pairedDecks, callback) {
    const range1 = decks.length;
    const range2 = Math.floor(decks.length / 3);
    var num1 = Math.floor(Math.random() * range1);
    var delta2 = Math.floor(Math.random() * range2) + 1;
    if (delta2 > (range2 / 2)) {
        delta2 = delta2 - range2 - 1;
    }
    console.log('delta = ' + delta2);
    var num2 = num1 + delta2;
    if (num2 < 0) {
        num2 = num1 + range2 + delta2;
    } else if (num2 >= range1) {
        num2 = num1 - range2 + delta2;
    }
    console.log('num1: ' + num1 + ' num2: ' + num2);

    Result.countDocuments({ $or: [{ $and: [ {"winningDeck": decks[num1].externalId}, {"losingDeck": decks[num2].externalId}]}, { $and: [ {"winningDeck": decks[num2].externalId}, {"losingDeck": decks[num1].externalId}]}]}, function(err, count) {
        if (count > 0) {
            console.log(decks[num1].externalId + " and " + decks[num2].externalId + " have played, so repairing");
            generateRandomPair(decks, pairedDecks, callback);
        } else {
            console.log("Pairing " + decks[num1].externalId + " and " + decks[num2].externalId);
            pairedDecks = [decks[num1], decks[num2]];
            callback(pairedDecks);
        }
    });
};

