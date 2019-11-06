#!/bin/bash

. rikitrakiws.default

#node rikitrakiws.js >rikitrakiws.log 2>&1
#usr/bin/node  rikitrakiws.js
/usr/bin/node --inspect-brk=127.0.0.1:9230  rikitrakiws.js
