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

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", '*');
    res.header("Access-Control-Allow-Credentials", true);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header("Access-Control-Allow-Headers", 'Origin,X-Requested-With,Content-Type,Accept,content-type,application/json');
    next();
});

app.set("view engine", "ejs");

const routesPath = path.resolve(__dirname, 'routes');
console.log(routesPath);
fstat.readdirSync(routesPath).forEach(file => {
    require(routesPath + '/' + file)(app);
})

app.listen(port, function() {
    console.log("Listening on port " + port);
});