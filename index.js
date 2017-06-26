// Imports and setup:
const express   = require("express");
var   mysql     = require('mysql');
const path      = require('path');
var   clients   = {};
const PORT      = process.env.PORT || 8080;
var server      = express().use("/", express.static(__dirname + "/http")).listen(PORT, () => console.log('Server started\nListening on ' + PORT));
const io        = require("socket.io")(server);
const squel     = require("squel");



// Vars and constants
const socketTags = {
    countLibraries: "countLibraries",
    getLibraries: "getLibraries",
    getCluster: "getCluster",
    serverError: "serverError"
};

const errors = {
    db: {
        connection: 0,
        query: 1
    }
};
var pool = mysql.createPool({
    connectionLimit: 100, //important
    host: '35.187.104.229',
    user: 'visitor',
    password: 'VisitMe1234',
    database: 'PrinterMap',
    debug: true
});



// Handle socket emissions
function onRequest(req, res) {
    // Gives EVERYONE cors-clearance:
    res.writeHead(200, {
        'Access-Control-Allow-Origin': '*'
    });
};

function handle_database(sessionID, sqlQuery, socketTag) {
    pool.getConnection(function(error, connection) {
        // Handle immediate connection errors:
        if (error) {
            handle_errors(sessionID, errors.db.connection);
            return;
        }

        // Send SQL query and handle response:
        connection.query(sqlQuery, function(error, rows) {
            connection.release();
            if (!error) {
                handle_emit_results(sessionID, rows, socketTag);
            } else {
                handle_errors(sessionID, errors.db.query);
            }
        });

        // Handle general connection errors:
        connection.on('error', function() {
            handle_errors(sessionID, errors.db.connection);
            return;
        });
    });
}

function handle_emit_results(sessionID, data, socketTag) {
    console.log("Client " + sessionID + " received " + data.length + " row(s) from database.");
    if (typeof clients[sessionID] !== 'undefined') {
        if(socketTag === socketTags.getCluster) data = filterRows(data);
        clients[sessionID].emit(socketTag, data);
        console.log("Emitting row(s) to " + clients[sessionID].id);
        console.log(JSON.stringify(data));
    }
}

function emit_remove_markers_message(sessionID){
    if(typeof clients[sessionID] !== 'undefined')
        clients[sessionID].emit("removeMarkers");
}

function handle_errors(sessionID, errorTag) {
    if(typeof clients[sessionID] !== 'undefined') {
        var errorText = "Client "+clients[sessionID]+" had an error ";
        errorText += getErrorString(errorTag)+".";
        clients[sessionID].emit(socketTags.serverError, {
            status: errorText
        });
        console.log(errorText);
    }
}




// Query building
function getCount(sessionID, bounds) {
    var sqlQuery = squel.select()
        .field("COUNT(*)", "count")
        .from("libraries")
        .where("lat > "+bounds.latA)
        .where("lat < "+bounds.latB)
        .where("lng > "+bounds.lngA)
        .where("lng < "+bounds.lngB)
        .toString();

    handle_database(sessionID, sqlQuery, socketTags.countLibraries);
}

function getLibs(sessionID, bounds) {
    var sqlQuery = squel.select()
        .field("name")
        .field("address")
        .field("lat")
        .field("lng")
        .from("libraries")
        .where("lat > "+bounds.latA)
        .where("lat < "+bounds.latB)
        .where("lng > "+bounds.lngA)
        .where("lng < "+bounds.lngB)
        .toString();

    handle_database(sessionID, sqlQuery, socketTags.getLibraries);
}

function getClusters(sessionID, bounds, zoomLevel) {
    emit_remove_markers_message();
    var grids = divideBoundsIntoGrids(bounds);
    grids.forEach(function(grid){
        var sqlQuery = constructClusterGridSqlQuery(grid);
        handle_database(sessionID, sqlQuery, socketTags.getCluster);
    });
}





// Handle socket listeners
io.on('connection', function(socket) {
    console.info("New client connected (id=" + socket.id + ").");
    clients[socket.id] = socket;
    clients[socket.id].canQuery = true;

    clients[socket.id].on('getCount', function(bounds) {
        getCount(socket.id, validateBoundsValues(bounds));
    });
    clients[socket.id].on('getLibraries', function(bounds) {
        getLibs(socket.id, validateBoundsValues(bounds));
    });
    clients[socket.id].on('getClusters', function(bounds) {
        var validatedBounds = validateBoundsValues(bounds);
        validatedBounds.gridsize = bounds.gridsize;
        var zoomLevel = bounds.zoom;
        getClusters(socket.id, validatedBounds, zoomLevel);
    });
    clients[socket.id].on('stopEverything', function() {
        if (typeof clients[socket.id] !== 'undefined') {
            clients[socket.id].canQuery = false;
            clients[socket.id].emit('removeMarkers');
        }
    });
    clients[socket.id].on('disconnect', function() {
        var index = clients[socket.id];
        if (index !== -1) {
            delete clients[socket.id];
            console.info("Client gone (id=" + socket.id + ").");
        }
    });
});





// Utility functions
function validateBoundsValues(bounds) {
    var parsedBounds = parseBoundsValuesAsFloat(bounds);
    var correctedBounds = correctMaxAndMinValues(parsedBounds);
    return enlargeBoundsArea(correctedBounds);
}

function enlargeBoundsArea(bounds) {
    var latDistance = (bounds.latB - bounds.latA) * 0.3;
    var lngDistance = (bounds.lngB - bounds.lngA) * 0.3;
    var result = {};
    result.latA = bounds.latA - latDistance;
    result.lngA = bounds.lngA - lngDistance;
    result.latB = bounds.latB + latDistance;
    result.lngB = bounds.lngB + lngDistance;
    return result;
}

function correctMaxAndMinValues(bounds) {
    var result = {};
    result.latA = Math.min(bounds.latA, bounds.latB);
    result.lngA = Math.min(bounds.lngA, bounds.lngB);
    result.latB = Math.max(bounds.latA, bounds.latB);
    result.lngB = Math.max(bounds.lngA, bounds.lngB);
    return result;
}

function parseBoundsValuesAsFloat(bounds) {
    var results = {};
    results.latA = parseFloat(bounds.latA);
    results.latB = parseFloat(bounds.latB);
    results.lngA = parseFloat(bounds.lngA);
    results.lngB = parseFloat(bounds.lngB);
    return results;
}

function divideBoundsIntoGrids(bounds) {
    var latGridDistance = (bounds.latB - bounds.latA) / bounds.gridsize;
    var lngGridDistance = (bounds.lngB - bounds.lngA) / bounds.gridsize;

    var grids = [];

    for(i = 0; i < bounds.gridsize; i++) {
        for(n = 0; n < bounds.gridsize; n++) {
            var grid = {};
            grid.latA = bounds.latA + (latGridDistance * i);
            grid.lngA = bounds.lngA + (lngGridDistance * n);
            grid.latB = grid.latA + latGridDistance;
            grid.lngB = grid.lngA + lngGridDistance;
            grids.push(grid);
        }
    }

    return grids;
}

function constructClusterGridSqlQuery(grid) {
    return squel.select()
            .field("AVG(lat)","lat")
            .field("AVG(lng)","lng")
            .field("COUNT(*)","count")
            .field("country")
            .field("MIN(lat)","startLat")
            .field("MIN(lng)","startLng")
            .field("MAX(lat)","endLat")
            .field("MAX(lng)","endLng")
            .from("libraries")
            .where("lat > "+grid.latA)
            .where("lat < "+grid.latB)
            .where("lng > "+grid.lngA)
            .where("lng < "+grid.lngB)
            .group("country")
            .toString();
}

function getErrorString(errorTag) {
    switch(errorTag) {
        case errors.db.connection:
            return "connecting to the database (code 100)";
            break;
        case errors.db.query:
            return "performing an SQL query (code 400)";
            break;
        default:
            return "of an unknown nature";
            break;
    }
}

function filterRows(rows, zoom) {
    var result = [];
    const zoomMultiplicator = -1.082;
    const mergeDistanceCorrection = 6.414;
    if(zoom === 0) zoom = 0.1;

    var mergeDistance = zoomMultiplicator * zoom + mergeDistanceCorrection;
    rows = mergeCloseMarkers(rows, mergeDistance);

    // Push non-empty markers to array, also remove markers with low count
    for (i = 0; i < rows.length; i++) {
        if (rows[i]["lat"] != null && rows[i]["count"] > 4) {
            result.push(rows[i]);
        }
    }
    return result;
}

function mergeCloseMarkers(rows, mergeDistance) {
    for (i = 0; i < rows.length; i++) {
        for (n = i + 1; n < rows.length; n++) {
            var distanceData = constructDistanceData(rows[i], rows[n]);
            if (distanceData.markerDist < mergeDistance) {
                var newLat = (distanceData.latOne + distanceData.latTwo) / 2;
                var newLng = (distanceData.lngOne + distanceData.lngTwo) / 2;
                var newCount = distanceData.countOne + distanceData.countTwo;
                rows[n]["lat"] = newLat;
                rows[n]["lng"] = newLng;
                rows[n]["count"] = newCount;
                rows[i]["lat"] = null;
                rows[i]["lng"] = null;
                rows[i]["count"] = null;
                n = rows.length;
            }
        }
    }
    return rows;
}

function constructDistanceData(rowA, rowB) {
    var result = {
        latOne: rowA["lat"],
        lngOne: rowA["lng"],
        countOne: rowA["count"],
        countryOne: rowA["country"],
        latTwo: rowB["lat"],
        lngTwo: rowB["lng"],
        countTwo: rowB["count"],
        countryTwo: rowB["country"]
    };
    result.markerDist = (Math.abs(result.latOne - result.latTwo) + Math.abs(result.lngOne - result.lngTwo)) / 2;
    return result;
}