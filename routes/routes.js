module.exports = function(app){

    app.get("/", function(req, res) {
        res.render("./index"); 
    });

    app.get("/createdeck", function(req, res) {
        res.render("./createdeck");
    });

    app.post("/createdeck", function(req, res, next) {
        var newDeck = new Deck({name: req.body.name, year: req.body.year, decklist: req.body.decklist, externalId: req.body.externalId});

        console.log(newDeck);
        newDeck.save(function (err, deck) {
            if (err) return console.error(err);
            console.log(deck.name + " successfully saved.");
        });
        res.redirect('/decks');
    });

    app.get("/decks", async (req, res) => {
        const decks = await Deck.find({});

        convertColorsToImg(decks);

        res.render("./decks", {decks});
    });

    function convertColorsToImg(decks) {
        decks.forEach(d => {
            d.colors = d.colors
                        .replace('W','<img src="W.png" width="15px" height="15px"/>')
                        .replace('U','<img src="U.png" width="15px" height="15px"/>')
                        .replace('B','<img src="B.png" width="15px" height="15px"/>')
                        .replace('R','<img src="R.png" width="15px" height="15px"/>')
                        .replace('G','<img src="G.png" width="15px" height="15px"/>');
        });
    };

    app.get("/standings", async (req, res) => {
        const decks = await Deck.find({}).sort({elo: "desc"});

        convertColorsToImg(decks);

        res.render("./standings", {decks});
    });

    app.get("/editdeck", async (req, res) => {
        console.log(req.query.id);
        var deck = await Deck.findOne({externalId: req.query.id});
        console.log(deck);
        res.render("./editdeck", {deck});
    });

    app.post("/editdeck", async (req, res, next) => {
        const update = {name: req.body.name, externalId: req.body.externalId, decklist: req.body.decklist, year: req.body.year, archetype: req.body.archetype, colors: req.body.colors};

        const deck = await Deck.findByIdAndUpdate(req.body.deckId, update, {
            new: true
        });

        res.render("./editdeck", {deck});
    });

    app.get("/deletedeck", async (req, res) => {
        var deck = await Deck.findById(req.query.id);
        res.render("./deletedeck", {deck});
    });

    app.post("/deletedeck", async (req, res, next) => {
        const deck = await Deck.findByIdAndRemove(req.body.deckid);
        
        res.redirect('/decks');
    });

    app.get("/logresult", async (req, res) => {
        const decks = await Deck.find({});
        res.render("./logresult", {decks});
    });

    app.post("/logresult", function(req, res, next) {
        if (req.body.wdeck == req.body.ldeck) {
            res.redirect('/logresult');
            return console.error('The same deck cannot play itself');
        } else {
            var was20 = req.body.was20 == "on";
            var lDeck = req.body.ldeck;
            console.log(req.body.randomdecks);
            if (req.body.randomdecks != null && req.body.randomdecks.length > 1) {
                var decknames = req.body.randomdecks.split(";");
                if (decknames[0] != req.body.wdeck) lDeck = decknames[0];
                if (decknames[1] != req.body.wdeck) lDeck = decknames[1];
            }
            console.log('losing deck ' + lDeck);
            const dateNow = Date.now();
            var newResult = new Result({winningDeck: req.body.wdeck, losingDeck: lDeck, was20: was20, date: dateNow});
            console.log(newResult);
            newResult.save(function (err, result) {
                if (err) return console.error(err);
                console.log("Result successfully entered");
                console.log('winning deck id ' + result.winningDeck);
                console.log('winning deck id ' + result.losingDeck);
                Deck.findOne({externalId: result.winningDeck}, function(err, windeck) {
                    Deck.findOne({externalId: result.losingDeck}, function(err, losedeck) {
                        if (windeck.elo == null) windeck.elo = 1500;
                        if (losedeck.elo == null) losedeck.elo = 1500;

                        console.log(windeck.externalId + " ELO: " + windeck.elo);
                        console.log(losedeck.externalId + " ELO: " + losedeck.elo);
                        const prob = 1 / (1 + Math.pow(10, (windeck.elo - losedeck.elo) / 400));
                        console.log(prob);
                        const scale = result.was20 ? 42 : 32;
                        console.log(scale);
                        const eloDelta = Math.ceil(scale * (prob));
                        console.log(eloDelta);
                        windeck.elo = windeck.elo + eloDelta;
                        losedeck.elo = losedeck.elo - eloDelta;
                        windeck.wins = windeck.wins + 1;
                        losedeck.losses = losedeck.losses + 1;

                        console.log('winning deck after elo = ' + windeck.elo);
                        console.log('losing deck after elo = ' + losedeck.elo);
                        
                        windeck.save();
                        losedeck.save();
                    });
                });
            });
        }

        if (req.body.randomdecks != null && req.body.randomdecks.length > 1) {
            res.redirect('/randompair');
        } else {
            res.redirect('/logresult');
        }
    });

    app.get("/deck", async (req, res) => {
        console.log(req.query.id);
        var deck = await Deck.findOne({externalId: req.query.id});
        console.log(deck);
        deck.colors = deck.colors
                        .replace('W','<img src="W.png" width="15px" height="15px"/>')
                        .replace('U','<img src="U.png" width="15px" height="15px"/>')
                        .replace('B','<img src="B.png" width="15px" height="15px"/>')
                        .replace('R','<img src="R.png" width="15px" height="15px"/>')
                        .replace('G','<img src="G.png" width="15px" height="15px"/>');
        var results = await Result.find({ $or: [ {"winningDeck": req.query.id}, {"losingDeck": req.query.id}]}).sort({date: "asc"});
        res.render("./deck", {deck, results});
    });

    app.get("/standingsapi", async(req, res) => {
        const decks = await Deck.find({}).sort({elo: "desc"});

        res.send(decks);
    });

    app.get("/resultsapi", async(req, res) => {
        if (req.query == null || req.query.id == null) {
            res.send(await Result.find({}).sort({date: "desc"}));
        } else {
            res.send( await Result.find({ $or: [ {"winningDeck": req.query.id}, {"losingDeck": req.query.id}]}).sort({date: "asc"}));
        }
    });

    app.get("/deckapi", async(req, res) => {
        var deck = await Deck.findOne({externalId: req.query.id});

        res.send(deck);
    });
}