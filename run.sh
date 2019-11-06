#!/bin/bash

. rikitrakiws.default

#node rikitrakiws.js >rikitrakiws.log 2>&1
#node  rikitrakiws.js
node --inspect-brk=127.0.0.1:9230  rikitrakiws.js
