module.exports = function(app) {
    const pairing = require("../controllers/pairing");

    app.get("/randompairapi", async(req, res) => {
        const decks = await Deck.find({}).sort({"elo": "desc"});

        var pairedDecks;

        pairing(decks, pairedDecks, function(pairedDecks) {
            res.send(pairedDecks);
        });
    });

    app.get("/randompair", async (req, res) => {
        const decks = await Deck.find({}).sort({"elo": "desc"});

        var pairedDecks;

        pairing(decks, pairedDecks, function(pairedDecks) {
            res.render("./randompair", {pairedDecks});
        });
    });
}