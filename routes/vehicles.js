'use strict';

// API router for vehicle resources
var passport = require('passport');
var MAX_VEHICLES = 500;

var log4js = require('log4js');
var logger = log4js.getLogger();

var schemas = require('../schemas/schemas').schemas;
var validator = require('is-my-json-valid');
var shortid = require('shortid');
const asyncHandler = require('express-async-handler');

module.exports = function(router, db) {

    var isValidToken = passport.authenticate('jwt', {
        session: false
    });

    router.get('/v1/vehicles/number', asyncHandler(async (req, res, next) => {
        const vehicles = await db.collection('vehicles');
        const count = await vehicles.find(req.query).count();
        res.send({numberOfVehicles: count});
    }));

    // Create a vehicle (must have valid token to succeed)
    router.post('/v1/vehicles', isValidToken, function(req, res) {
        logger.debug('add vehicle', req.body.name);

        var v = validator(schemas.vehicleRegistrationSchema);
        if (v(req.body)) {
            var vehicle = {};
            vehicle.name = req.body.name;
            // let b = Buffer.from(req.body.blob, 'base64');
            vehicle.blob = req.body.blob;
            vehicle.type = req.body.type;
            vehicle.description = req.body.description;
            vehicle.owner = req.body.owner;
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

    // retrieve one or more vehicles
    // query: name=vehiclename -> retrieve a single vehicle
    // query: owner=foo -> all vehicles of user foo
    // includie blob if ?blob=x is given
    router.get('/v1/vehicles/', function(req, res) {
        db.collection('vehicles', function(err, collection) {
            var p = {
                _id: false,
                name: true,
                type: true,
                description: true,
                createdDate: true,
                owner: true,
            };
            if (req.query.blob ) {
                p.blob = true;
            }
            var q = {};
            if (req.query.name) {
                q.name = req.query.name;
            }
            if (req.query.owner) {
                q.owner = req.query.owner;
            }

            collection.find(q, {
                limit: MAX_VEHICLES,
                sort: {
                    createdDate: -1
                },
                fields: p
            }, function(err, stream) {
                var result = {};
                result.vehicles = {};
                stream.on('data', function(data) {
                    result.vehicles[data.name] = data;
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

    // Delete a vehicle by name (must have valid token to succeed)
    router.delete('/v1/vehicles/:name', isValidToken, function(req, res) {
        var vehicle = req.params.name;
        logger.info('delete vehicle: ' + vehicle);
        db.collection('vehicles', function(err, vehiclesCollection) {
            vehiclesCollection.findOne({
                $and: [{
                    'name': vehicle
                }, {
                    'owner': req.user
                }]
            }, {
                _id: false,
                name: true
            }, function(err, item) {
                if (item) {
                    vehiclesCollection.remove({
                        'name': vehicle
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
                        description: 'name: ' + vehicle
                    });
                }
            });
        });
    });

};
