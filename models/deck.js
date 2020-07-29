const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const DeckSchema = mongoose.Schema({
    name: String,
    externalId: String,
    decklist: String,
    year: Number,
    elo: Number,
    wins: Number,
    losses: Number,
    colors: String,
    archetype: String
});

Deck = mongoose.model('Deck', DeckSchema, 'decks');