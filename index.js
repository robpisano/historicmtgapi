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
    res.render("decks", {decks});
});

app.get("/standings", async (req, res) => {
    const decks = await Deck.find({}).sort({elo: "desc"});
    res.render("standings", {decks});
});

app.get("/editdeck", async (req, res) => {
    console.log(req.query.id);
    var deck = await Deck.findOne({externalId: req.query.id});
    console.log(deck);
    res.render("editdeck", {deck});
});

app.post("/editdeck", async (req, res, next) => {
    const update = {name: req.body.name, externalId: req.body.externalId, decklist: req.body.decklist, year: req.body.year};

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
        var newResult = new Result({winningDeck: req.body.wdeck, losingDeck: lDeck, was20: was20});
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
                    const prob = 1 / (1 + Math.pow(10, (losedeck.elo - windeck.elo) / 400));
                    console.log(prob);
                    const scale = result.was20 ? 42 : 32;
                    console.log(scale);
                    const eloDelta = Math.ceil(scale * (prob));
                    console.log(eloDelta);
                    windeck.elo = windeck.elo + eloDelta;
                    losedeck.elo = losedeck.elo - eloDelta;

                    console.log('winning deck after elo = ' + windeck.elo);
                    console.log('losing deck after elo = ' + losedeck.elo);
                    
                    windeck.save();
                    losedeck.save();
                });
            });
        });
    }

    res.redirect('/logresult');
});

app.get("/deck", async (req, res) => {
    console.log(req.query.id);
    var deck = await Deck.findOne({externalId: req.query.id});
    console.log(deck);
    var results = await Result.find({ $or: [ {"winningDeck": req.query.id}, {"losingDeck": req.query.id}]});
    var wins = 0;
    var losses = 0;
    results.forEach(res => {
        if (res.winningDeck == req.query.id) {
            wins++;
        } else {
            losses++;
        }
    });
    res.render("deck", {deck, results, wins, losses});
});


app.get("/randompair", async (req, res) => {
    const decks = await Deck.find({});

    var pairedDecks;

    pairedDecks = generateRandomPair(decks, pairedDecks);

    res.render("randompair", {pairedDecks});
});

function generateRandomPair(decks, pairedDecks) {
    var num1 = Math.floor(Math.random() * decks.length);
    var num2 = Math.floor(Math.random() * (decks.length - 1));
    if (num2 == num1) num2 = decks.length - 1;

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