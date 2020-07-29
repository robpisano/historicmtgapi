const dotenv = require("dotenv").config({path:__dirname + "/.env"});
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const res = require("express/lib/response");
const path = require('path');
const fstat = require("fs");

const moment = require("moment");

const modelsPath = path.resolve(__dirname, 'models');
console.log(modelsPath);
fstat.readdirSync(modelsPath).forEach(file => {
    require(modelsPath + '/' + file);
})

const mongoUsername = process.env.MONGO_USERNAME;
const mongoPassword = process.env.MONGO_PASSWORD;
const mongoDb = process.env.MONGO_URI;
const mongoUri = "mongodb+srv://" + mongoUsername + ":" + mongoPassword + mongoDb + "?w=majority&retryWrites=true";

mongoose.connect(mongoUri, {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true});

var db = mongoose.connection;

db.once("open", function() {
    console.log("Connected to MongoDB");
});

let app = new express();
const port = process.env.PORT || 8787;
let http = require("http").Server(app);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname + '/public'));

app.use((req, res, next)=>{
    res.locals.moment = moment;
    next();
});

app.use(express.static('resources'));

app.get("/", function(req, res) {
    res.sendFile(__dirname + "/views/index.html");
});

app.get("/createdeck", function(req, res) {
    res.sendFile(__dirname + "/views/createdeck.html");
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

app.set("view engine", "ejs");

app.get("/decks", async (req, res) => {
    const decks = await Deck.find({});

    convertColorsToImg(decks);

    res.render("decks", {decks});
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

    res.render("standings", {decks});
});

app.get("/editdeck", async (req, res) => {
    console.log(req.query.id);
    var deck = await Deck.findOne({externalId: req.query.id});
    console.log(deck);
    res.render("editdeck", {deck});
});

app.post("/editdeck", async (req, res, next) => {
    const update = {name: req.body.name, externalId: req.body.externalId, decklist: req.body.decklist, year: req.body.year, archetype: req.body.archetype, colors: req.body.colors};

    const deck = await Deck.findByIdAndUpdate(req.body.deckId, update, {
        new: true
    });

    res.render("editdeck", {deck});
});

app.get("/deletedeck", async (req, res) => {
    var deck = await Deck.findById(req.query.id);
    res.render("deletedeck", {deck});
});

app.post("/deletedeck", async (req, res, next) => {
    const deck = await Deck.findByIdAndRemove(req.body.deckid);
    
    res.redirect('/decks');
});

app.get("/logresult", async (req, res) => {
    const decks = await Deck.find({});
    res.render("logresult", {decks});
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
    var results = await Result.find({ $or: [ {"winningDeck": req.query.id}, {"losingDeck": req.query.id}]}).sort({date: "asc"});
    res.render("deck", {deck, results});
});


app.get("/randompair", async (req, res) => {
    const decks = await Deck.find({}).sort({"elo": "desc"});

    var pairedDecks;
    console.log('get random pair called');

    pairedDecks = generateRandomPair(decks, pairedDecks);

    res.render("randompair", {pairedDecks});
});

function generateRandomPair(decks, pairedDecks) {
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

    if (Result.find({ $or: [{ $and: [ {"winningDeck": decks[num1].externalId}, {"losingDeck": decks[num2].externalId}]}, { $and: [ {"winningDeck": decks[num2].externalId}, {"losingDeck": decks[num1].externalId}]}]}).length > 0) {
        console.log(decks[num1].externalId + " and " + decks[num2].externalId + " have played, so repairing");
        generateRandomPair(decks, pairedDecks);
    } else {
        console.log("Pairing " + decks[num1].externalId + " and " + decks[num2].externalId);
        pairedDecks = [decks[num1], decks[num2]];
        return pairedDecks;
    }
};

app.listen(port, function() {
    console.log("Listening on port " + port);
});