'use strict';

var log4js = require('log4js');
var logger = log4js.getLogger();

var express = require('express');
var router = express.Router();
var mongo = require('mongodb');
var mongoClient = mongo.MongoClient;
var MONGO_URL = process.env.MONGODB_DB_URL ? (process.env.MONGODB_DB_URL) : 'mongodb://127.0.0.1/';
var MONGO_DB_NAME = process.env.MONGO_DB_NAME ? (process.env.MONGO_DB_NAME) : 'rikitraki';
var JWT_SECRET = process.env.JWT_SECRET || 'eventually instead of this we will use a public key';

var passport = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;
var JwtStrategy = require('passport-jwt').Strategy;

var bcrypt = require('bcryptjs');

async function createIndices(db) {
	let users = await db.createCollection('users');
	if (!await users.indexExists('username_unique')) {
		logger.info('creating index on users.username');
		await users.createIndex({ 'username' : 1} , {unique:true, name: 'username_unique' });
	}
	if (!await users.indexExists('email_unique')) {
		logger.info('creating index on users.email');
		await users.createIndex({ 'email' : 1} , {unique:true, name: 'email_unique' });
	}
	let invitations = await db.createCollection('invitations');
	if (!await invitations.indexExists('email_unique')) {
		logger.info('creating index on invitations.email');
		await invitations.createIndex({ 'email' : 1} , {unique:true, name: 'email_unique' });
	}
	let pictures = await db.createCollection('pictures');
	if (!await pictures.indexExists('trackId_picIndex')) {
		logger.info('creating index on pictures.trackId_picIndex');
		await pictures.createIndex({ 'trackId' : 1, 'picIndex' : 1} , {unique:true, name: 'trackId_picIndex' });
	}
	let tracks = await db.createCollection('tracks');
	if (!await tracks.indexExists('trackId_picIndex')) {
		logger.info('creating index on tracks.trackId_picIndex');
		await tracks.createIndex({ 'trackId' : 1} , {unique:true, name: 'trackId_unique' });
	}
	if (!await tracks.indexExists('trackGeoJson_idx')) {
		logger.info('creating index on tracks.trackGeoJson');
		await tracks.createIndex({ 'trackGeoJson' : '2dsphere'} , {name: 'trackGeoJson_idx' });
	}
	if (!await tracks.indexExists('createdDate_idx')) {
		logger.info('creating index on tracks.createdDate');
		await tracks.createIndex({ 'createdDate' : 1} , { name: 'createdDate_idx' });
	}
	if (!await tracks.indexExists('username_idx')) {
		logger.info('creating index on tracks.username');
		await tracks.createIndex({ 'username' : 1} , { name: 'username_idx' });
	}
	let vehicles = await db.createCollection('vehicles');
	if (!await vehicles.indexExists('vehicles_idx')) {
		logger.info('creating index on vehicles.name');
		await vehicles.createIndex({ 'name' : 1} , {unique:true, name: 'vehicles_idx' });
	}
}

(async function (url, dbname) {
	logger.info('connecting to database:', url, dbname);

	try {
		var client = await mongoClient.connect(url);
	} catch (err) {
		logger.error('cannot connect to database', err);
	    return "fail";
	}
	var db = client.db(dbname)

	let c = await createIndices(db);

	router.use(function (req, res, next) {
		// Set up CORS headers
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Credentials: true');
		res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
  		res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

		next();
	});

	// Setup basic authentication middleware
	passport.use(new BasicStrategy(
		function(username, password, callback) {
			db.collection('users', function (err, collection) {
				collection.findOne({'username' : username}, function (err, user) {
					if (user) {
						if (bcrypt.compareSync(password, user.password)) {
						//if (user.password === password) {
							return callback(null, user);
						} else {
							return callback(null, false);
						}
					} else {
						return callback(null, false);
					}
				});
			});
		}
	));

	// Setup JWT token authentication middleware
	var opts = {};
	opts.secretOrKey = JWT_SECRET;
	passport.use(new JwtStrategy(opts,
		function(jwtPayload, callback) {
			callback(null, jwtPayload.sub, jwtPayload);
		}
	));

	// List of api resources below
	require('./users')(router, db);
	require('./tracks')(router, db);
	require('./vehicles')(router, db);

	return "success";

})(MONGO_URL,MONGO_DB_NAME).then(v => {
	logger.info('setup returned:',v);

});

module.exports.router = router;
module.exports.JWT_SECRET = JWT_SECRET;
