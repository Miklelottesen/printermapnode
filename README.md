# Printer Map Server
**Refer to the documentation PDF in this repo for basic usage info**

A Node JS solution, which will connect to a client with sockets. The client (a Google Maps solution) can request location info based on visible area of the map, and this server will query the SQL database with libraries and return JSON objects with info for creating map markers.

A browser client is already included in this solution (in the http folder), and when the server is started, the solution can be viewed in a browser by visiting the servers IP/URL.

Socket connections from other clients, such as mobile apps, can be established through the server's IP/URL.

**File structure:**
-
* **http**
    * **imgs** (image files)
    * **index.html** (markup for web client)
    * **markerclustering.js** (Google's clustering library)
    * **printermap.css** (styling for web client)
    * **printermap.js** (javascript for web client)
* **index.js** (Node.js server script)
* **NodeServerDocumentation.pdf** (instructions on connecting to and using the server)
* **package.json** (server configuration)
* **README.md** (this readme)