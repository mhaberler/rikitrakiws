#!/usr/local/bin/python3
import requests
from requests.auth import HTTPBasicAuth
import json
import os
import jwt
import base64
import uuid
import glob
import os
import sys
import hashlib

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
            print(r.json())
            return r.json()["numberOfVehicles"]
        raise BackendError("getNumVehicles failed: error={} {}".format(r.error,r.message))

# def GET(self,r):
#     user_data = CC.get_data(query) # holds the content of the blob field.
#     data = {'name': 'test',
#            'photo': base64.b64encode(user_data)}
#     return json.dump(data)


    def createVehicle(self, name, description, owner, filename, type):
        with open(filename, 'rb') as fd:
            b = fd.read()
            a = base64.b64encode(b)
            b64 = a.decode('utf-8')
            m = hashlib.md5()
            m.update(b)
            #print("blob bin md5=",m.hexdigest(),'sliceab=', b[0:10],'slicea=', a[0:10],'sliceb64=', b64[0:10])
            #print("blob bin md5=",m.hexdigest(),'sliceb64=', b64[0:30])
            payload = {
                'name' : name,
                'description' : description,
                'owner' : owner,
                'blob' : b64,
                'type' : type
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

    def getVehicles(self, query={}):
        url = "{}://{}:{}/api/v1/vehicles".format(self.method, self.server, self.port, id)
        r = requests.get(url, headers={'Authorization': 'JWT {}'.format(rws.jwt)}, params=query)
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


#    t = rws.getVehicles({'name': 'OE-SOE-retry', 'blob': True})
#    with open('OE-SOE-retry.b64-fromserver', 'w') as fd:
#        fd.write(t["vehicles"]["OE-SOE-retry"]["blob"])

    #print("vehicles:\n{}".format(json.dumps(t, indent=4, sort_keys=True)))

#if False:

    # all vehicles
#    t = rws.getVehicles({})
#    print("vehicles:\n{}".format(json.dumps(t, indent=4, sort_keys=True)))

    glbdir = "/Users/mah/Ballon/src/rikitraki/static/images/"
    glbs = [x for x in os.listdir(glbdir) if x.endswith(".glb")]
    for g in glbs:
        fn = glbdir + g
        vn = os.path.splitext(os.path.basename(g))[0]
        print("inserting: ",vn)
        v = rws.createVehicle(vn, "n/a",rws.user, fn, "glb")
    sys.exit(0)



    t = rws.getNumVehicles()
    print("number of vehicles: {}".format(t))

if False:

    vn = "vehicle-" + uuid.uuid4().hex
    #fn = "/Users/mah/Ballon/src/rikitraki/images/OE-SOE.glb"
    fn = "foobar.base64"
    v = rws.createVehicle(vn, "no aans",rws.user, fn, "png")
    print("vehicle:\n{}".format(json.dumps(v, indent=4, sort_keys=True)))

    t = rws.getVehicles({'name': vn, 'blob': True})
    print("vehicles:\n{}".format(json.dumps(t, indent=4, sort_keys=True)))

    # all vehicles
    t = rws.getVehicles({'blob': True})
    print("vehicles:\n{}".format(json.dumps(t, indent=4, sort_keys=True)))

    t = rws.deleteVehicle(vn)
    print("deleted vehicle:\n{}".format(t))

if False:

    fn = "foobar.base64"
    v = rws.createVehicle("fasel2", "no aans",rws.user, fn, "png")
    print("vehicle:\n{}".format(json.dumps(v, indent=4, sort_keys=True)))



    t = rws.deleteVehicle(v["id"])
    print("deleted vehicle:\n{}".format(t))


    t = rws.getNumVehicles()
    print("number of vehicles: {}".format(t))

    if t > 0:
        t = rws.getVehicles({})
        print("vehicles:\n{}".format(json.dumps(t, indent=4, sort_keys=True)))

        for id in t["vehicles"].keys():
            print("id=", id)
            v = rws.getVehicles({'vehicleId' : id, 'blob' : True})
            print("vehicles:\n{}".format(json.dumps(v, indent=4, sort_keys=True)))


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
