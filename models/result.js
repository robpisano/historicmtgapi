const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ResultSchema = mongoose.Schema({
    winningDeck: String,
    losingDeck: String,
    was20: {
        type: Boolean,
        default: false
    },
    date: {
        type: Date,
        default: Date.now()
    }
});

Result = mongoose.model('Result', ResultSchema, 'results');