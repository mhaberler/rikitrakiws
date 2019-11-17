#!/usr/local/bin/python3
import requests
from requests.auth import HTTPBasicAuth
import json
import os
import jwt
import base64

class BackendError(Exception):
    def __init__(self, value):
        self.value = value
    def __str__(self):
        return(repr(self.value))


class RikiTrakiWSAPI(object):
    def __init__(self,
            server="127.0.0.1",
            port=3000, method="http",
            user=None, password=None,
            jwt_secret=None):
        self.server = server
        self.port = port
        self.method = method
        if user is None:
            self.user = os.environ.get("API_USER")
        else:
            self.user = user
        if password is None:
            self.password = os.environ.get("API_PASS")
        else:
            self.password = password
        if jwt_secret is None:
            self.jwt_secret = os.environ.get("JWT_SECRET")
        else:
            self.jwt_secret = jwt_secret
        self.jwt = None

    def getJWTToken(self, user=None, password=None):
        url = "{}://{}:{}/api/v1/token/".format(self.method, self.server, self.port)
        if user is None:
            user = self.user
        if password is None:
            password = self.password
        r = requests.get(url, auth=HTTPBasicAuth(user, password), verify=True)
        if r.status_code == 200:
            self.jwt = r.text
            return r.text
        raise BackendError("getJWTToken failed: rc={} ".format(r.status_code))

    def getProfile(self, jwt=None):
        url = "{}://{}:{}/api/v1/users/me".format(self.method, self.server, self.port)
        if jwt is None:
            jwt = self.jwt
        r = requests.get(url, headers={'Authorization': 'JWT {}'.format(jwt)})
        if r.status_code == 200:
            return r.text
        raise BackendError("getProfile failed: rc={} ".format(r.status_code))

    def getTrack(self, id=""):
        url = "{}://{}:{}/api/v1/tracks/{}".format(self.method, self.server, self.port, id)
        r = requests.get(url)
        if r.status_code == 200:
            return r.text

    def getGPX(self, id):
        url = "{}://{}:{}/api/v1/tracks/{}/GPX".format(self.method, self.server, self.port, id)
        r = requests.get(url)
        if r.status_code == 200:
            return r.text

    def getNumVehicles(self):
        url = "{}://{}:{}/api/v1/vehicles/number".format(self.method, self.server, self.port)
        r = requests.get(url)
        if r.status_code == 200:
            return r.json()["numberOfVehicles"]
        raise BackendError("getNumVehicles failed: error={} {}".format(r.error,r.message))

# def GET(self,r):
#     user_data = CC.get_data(query) # holds the content of the blob field.
#     data = {'name': 'test',
#            'photo': base64.b64encode(user_data)}
#     return json.dump(data)


    def createVehicle(self, name, description, owner, filename, type):
        with open(filename, 'rb') as fd:
            payload = {
                'name' : name,
                'description' : description,
                'owner' : owner,
                'blob' : str(base64.b64encode(fd.read())),
                'blobtype' : type
            }
            url = "{}://{}:{}/api/v1/vehicles".format(self.method, self.server, self.port)
            r = requests.post(url, headers={'Authorization': 'JWT {}'.format(rws.jwt)},  json=payload)
            if r.status_code == 200:
                return r.json()
            raise BackendError("createVehicle failed: error={} {}".format(r.error,r.message))

    def deleteVehicle(self, id):
        url = "{}://{}:{}/api/v1/vehicles/{}".format(self.method, self.server, self.port, id)
        r = requests.delete(url, headers={'Authorization': 'JWT {}'.format(rws.jwt)})
        return r.text

    def getVehicles(self, query):
        url = "{}://{}:{}/api/v1/vehicles".format(self.method, self.server, self.port, id)
        r = requests.get(url, headers={'Authorization': 'JWT {}'.format(rws.jwt)}, json=query)
        return r.json()

    # def getVehicle(self, id):
    #     url = "{}://{}:{}/api/v1/vehicle/{}".format(self.method, self.server, self.port, id)
    #     r = requests.get(url, headers={'Authorization': 'JWT {}'.format(rws.jwt)})
    #     return r.json()


#rws = RikiTrakiWSAPI(server="rikitrakiws.mah.priv.at",method="https",port=443)
rws = RikiTrakiWSAPI()

if True:
    t = rws.getJWTToken()
    print("got jwt")
    if rws.jwt_secret:
        print("decoded token: {}".format(jwt.decode(t, rws.jwt_secret, algorithms=['HS256'])))
    else:
        print("token: {}".format(t))

    t = rws.getNumVehicles()
    print("number of vehicles: {}".format(t))

    if t > 0:
        t = rws.getVehicles({})
        print("vehicles:\n{}".format(json.dumps(t, indent=4, sort_keys=True)))

        for id in t["vehicles"].keys():
            print("id=", id)
            v = rws.getVehicles({'vehicleId' : id, 'blob' : True})
            print("vehicles:\n{}".format(json.dumps(v, indent=4, sort_keys=True)))


    fn = "foobar.base64"
    #fn = "/Users/mah/Ballon/src/rikitraki/images/OE-SOE.glb"
    v = rws.createVehicle("fasel", "no aans","mail17", fn, "png")
    print("vehicle:\n{}".format(json.dumps(v, indent=4, sort_keys=True)))

    t = rws.deleteVehicle(v["id"])
    print("deleted vehicle:\n{}".format(t))

if False:
    t = rws.getNumVehicles()
    print("number of vehicles:\n{}".format(json.dumps(json.loads(t), indent=4, sort_keys=True)))

    p = rws.getProfile(t)
    print("profile:\n{}".format(json.dumps(json.loads(p), indent=4, sort_keys=True)))

    t = rws.getTrack()
    print("tracks:\n{}".format(json.dumps(json.loads(t), indent=4, sort_keys=True)))

    id = "jta7S77O"
    t = rws.getTrack(id=id)
    print("track '{}':\n{}".format(id, json.dumps(json.loads(t), indent=4, sort_keys=True)))

    t = rws.getGPX(id)
    print("GPX({}):\n{}".format(id, t))
