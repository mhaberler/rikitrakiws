'use strict';

const frisby = require('frisby');
const Joi = frisby.Joi; // Frisby exposes Joi for convenience
const jwt = require('jsonwebtoken');

var port = process.env.npm_package_config_testport || 3001;
var url = 'http://localhost:' + port;
var v1 = '/api/v1';
var token = '';


it ('obtain a token (unauthorized) - expect 401', function () {
  return frisby
    .get(url + v1 + '/token')
    .expect('status', 401);
});


it ('obtain and record a JWT - expect 200', function () {
  return frisby
    .setup({request: {
        headers: {
            'Authorization': 'Basic ' + Buffer.from(process.env.TEST_USER + ':' + process.env.TEST_PASSWORD).toString('base64'),
            'Content-Type': 'application/json',
        }
    }})
    .get(url + v1 + '/token')
    .expect('status', 200)
    .then(function (res) { // res = FrisbyResponse object
        token = res._body; // record for below
//        console.log(jwt.decode(token));
    });
});

it ('retrieve user details without JWT - expect 401', function () {
  return frisby
    .get(url + v1 + '/users')
    .expect('status', 404)
    //.inspectResponse()
    ;
});


it ('retrieve user details using nonexistent user JWT - expect 404', function () {
  return frisby
    .setup({request: {
        headers: {
            'Authorization': 'JWT ' + jwt.sign({
                    'sub': 'nonexistentuser',
                }, process.env.JWT_SECRET, {'issuer': process.env.JWT_ISSUER})
        }
    }})
    .get(url + v1 + '/users/me')
    .expect('status', 404)
    .then(function (res) {
        expect(res.json.error).toBe("NotFound");
        expect(res.json.description).toBe("username not found");
    });
});

it ('retrieve user details using JWT containing a valid user - expect 200', function () {
  return frisby
    .setup({request: {
        headers: {
            'Authorization': 'JWT ' + token,
        }
    }})
    .get(url + v1 + '/users/me')
    .expect('status', 200)
    .then(function (res) {
        expect(res.json.username).toBe("testuser");
        expect(res.json.email).toBe("foo@bar.com");
    });
});


it('retrieve number of vehicles', function(doneFn) {
  frisby.get(url + v1 + '/vehicles/number')
    .expect('status', 200)
    .expect('jsonTypes', 'result.*', {'result': [{'numberOfVehicles': Joi.number()}]})
    .done(doneFn);
});


it('create new vehicle', function(doneFn) {
  frisby
    .setup({request: {
      headers: {
          'Authorization': 'JWT ' + token,
      }
    }})
    .post(url + v1 + '/vehicles', {
        'name' : 'testvehicle',
        'description' : 'descriptive text',
        'owner' : 'testuser',
        'blob' : 'YmxhaGZhc2VsLmluCg==', //str(base64.b64encode(fd.read())),
        'blobtype' : 'glb'
        })
    .expect('status', 200)
    //.expect('jsonTypes', 'result.*', {'result': [{'numberOfVehicles': Joi.number()}]})

    .inspectJSON()
    .done(doneFn);
});
