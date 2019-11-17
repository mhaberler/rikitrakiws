'use strict';

// API router for vehicle resources
var passport = require('passport');
var MAX_VEHICLES = 500;

var log4js = require('log4js');
var logger = log4js.getLogger();

var schemas = require('../schemas/schemas').schemas;
var validator = require('is-my-json-valid');
var shortid = require('shortid');
//var path    = require('path');


module.exports = function(router, db) {

    var isValidToken = passport.authenticate('jwt', {
        session: false
    });
    function buildTracksQuery (queryparms) {
		var query = {};

		// TODO: include latlng query inside of filter
		if (queryparms.latlng) {
			var latlng = queryparms.latlng.split(',');
			var lnglat = [];
			var distance = 0;
			if (latlng.length === 2) {
				lnglat[1] = parseFloat(latlng[0]);
				lnglat[0] = parseFloat(latlng[1]);
				if ((lnglat[0] < 180) && (lnglat[0] > -180) && (lnglat[1] < 90) && (lnglat[1] > -90)) {
					if (queryparms.distance) {
						distance = parseInt(queryparms.distance);
						distance = distance ? distance : 0;
					}
					query = {trackGeoJson: {$near: {$geometry: {type: 'Point', coordinates: lnglat}, '$maxDistance': distance}}};
					logger.info('query', query);
				}
			}
		}

		if (queryparms.filter) {
			var filter = JSON.parse(queryparms.filter);
			if (filter.username) {
				query.username = {$regex : new RegExp('^' + filter.username)}; // Begins with
			}
			if (filter.trackFav) {
				query.trackFav = true;
			}
			var i = 0;
			if (filter.level) {
				var levels = filter.level.split(',');
				query.$and = [{$or: [] }];
				for (i=0; i<levels.length; i++) {
					query.$and[0].$or.push({trackLevel: levels[i]});
				}
			}
			if (filter.activity) {
				var activities = filter.activity.split(',');
				var j = 0;
				if (!query.$and) {
					query.$and = [{$or: [] }];
				} else {
					j = 1;
					query.$and.push({$or: [] });
				}
				for (i=0; i<activities.length; i++) {
					if (activities[i] === 'Hiking') {
						query.$and[j].$or.push({trackType: { $exists: false }});
					}
					query.$and[j].$or.push({trackType: activities[i]});
				}
			}
			if (filter.country) {
				query.trackRegionTags = {$in: [filter.country]};
			}
			if (filter.region) {
				query.trackRegionTags = {$in: [filter.region]};
			}
		}
		logger.info('query', query);
		return query;
	}

    // retrieve number of vehicles
    router.get('/v1/vehicles/number', function(req, res) {
        logger.debug('get number of vehicles');
        db.collection('vehicles', function(err, collection) {
            //var query = buildTracksQuery(req.query);
            collection.find(req.query).count(function(err, count) {
                logger.debug('number of vehicles is...', count);
                if (err) {
                    logger.error('database error', err.message);
                    res.status(507).send({
                        error: 'DatabaseQueryError',
                        description: err.message
                    });
                }
                else {
                    res.send({
                        numberOfVehicles: count
                    });
                }
            });
        });
    });

    // Create a vehicle (must have valid token to succeed)
    router.post('/v1/vehicles', isValidToken, function(req, res) {
        logger.debug('add vehicle', req.body);
        var v = validator(schemas.vehicleRegistrationSchema);
        if (v(req.body)) {
            var vehicle = {};
            vehicle.vehicleName = req.body.name;
            vehicle.vehicleId = shortid.generate();
            vehicle.vehicleBlob = Buffer.from(req.body.blob, 'base64');
            vehicle.vehicleBlobType = req.body.blobtype;
            vehicle.vehicleDescription = req.body.description;
            vehicle.vehicleOwner = req.body.owner;
            vehicle.createdDate = new Date();

            db.collection('vehicles').insert(vehicle, {
                w: 1
            }, function(err) {
                if (err) {
                    if (err.code === 11000) {
                        res.status(422).send({
                            error: 'Duplicate',
                            description: 'vehicle already exists'
                        });
                    }
                    else {
                        logger.error('database error', err.code);
                        res.status(507).send({
                            error: 'DatabaseInsertError',
                            description: err.message
                        });
                    }
                }
                else {
                    res.status(200).send({
                        name: vehicle.vehicleName,
                        id: vehicle.vehicleId
                    });
                }
            });

        }
        else {
            logger.error('validator ', v.errors);
            res.status(400).send({
                error: 'InvalidInput',
                'description': v.errors
            });
        }
    });

    // retrieve vehicle info
    // include blob if ?blob=true is given
    router.get('/v1/vehicles/:vehicleId', function(req, res) {
        var vehicleId = req.params.vehicleId;
        logger.debug('retrieve vehicle: ' + vehicleId);
        db.collection('vehicles', function(err, collection) {
            var p = {
                _id: false,
                vehicleName: true,
                vehicleType: true,
                vehicleDescription: true,
                createdDate: true,
                vehicleOwner: true,
                vehicleBlobType: true
            };
//            if (req.query.blob === 'true') {
                if (req.query.blob === 'true') {
                logger.debug('retrieve vehicle: ' + vehicleId + ' including blob');
                p.vehicleBlob = true;
            }
            collection.findOne({
                'vehicleId': vehicleId
            }, p, function(err, item) {
                if (item) {
                    res.send(item);
                }
                else {
                    logger.error('vehicle ' + vehicleId + ' not found');
                    res.status(404).json({
                        error: 'NotFound',
                        description: 'vehicle not found'
                    });
                }
            });
        });
    });

    // retrieve all vehicles, including blob if ?blob=x is given
    router.get('/v1/vehicles/', function(req, res) {
        logger.info('retrieve vehicles: ' + req.query);
        db.collection('vehicles', function(err, collection) {
            var p = {
                _id: false,
                // blob: false, // req.query.blob == 'true',
                vehicleName: true,
                vehicleType: true,
                vehicleDescription: true,
                createdDate: true,
                vehicleOwner: true,
                vehicleBlobType: true
            };
            collection.find({}, {
                limit: MAX_VEHICLES,
                sort: {
                    createdDate: -1
                },
                fields: p
            }, function(err, stream) {
                var result = {};
                result.vehicles = {};
                stream.on('data', function(data) {
                    result.vehicles[data.vehicleId] = data;
                });
                stream.on('end', function() {
                    if (Object.keys(result.vehicles).length === 0) {
                        logger.info('no vehicles found');

                        // res.status(404).send({error: 'NotFound', description: 'query returned no data'});
                        // res.status(204).send();
                        res.status(204).send({
                            vehicles: {}
                        });
                    }
                    else {
                        res.send(result);
                    }
                });
            });
        });
    });

    // Delete a vehicle by id (must have valid token to succeed)
    router.delete('/v1/vehicles/:vehicleId', isValidToken, function(req, res) {
        var vehicleId = req.params.vehicleId;
        logger.info('delete vehicle: ' + vehicleId);
        db.collection('vehicles', function(err, vehiclesCollection) {
            vehiclesCollection.findOne({
                $and: [{
                    'vehicleId': vehicleId
                }, {
                    'owner': req.user
                }]
            }, {
                _id: false,
                vehicleId: true
            }, function(err, item) {
                if (item) {
                    vehiclesCollection.remove({
                        'vehicleId': vehicleId
                    }, {
                        w: 1
                    }, function(err) {
                        if (err) {
                            logger.error('database error', err.code);
                            res.status(507).send({
                                error: 'DatabaseDocRemoveError',
                                description: err.message
                            });
                        }
                        else {
                            res.status(204).send();
                        }
                    });
                }
                else {
                    res.status(507).send({
                        error: 'vehicle not found',
                        description: 'id: ' + vehicleId
                    });
                }
            });
        });
    });

};
