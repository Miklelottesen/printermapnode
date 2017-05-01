const express   =    require("express");
var mysql     =    require('mysql');
const path = require('path');
//var app       =    express();
//var server    =    require('http').createServer(onRequest);
//var io        =    require('socket.io')(1337);
//var fs        =    require('fs');
var clients = {};

const PORT = process.env.PORT || 8080;
const INDEX = path.join(__dirname, 'http/index.html');

const server = express()
	.use("/", express.static(__dirname + "/http"))
	.listen(PORT, () => console.log('Server started\nListening on '+PORT));

const io = require("socket.io")(server);

/*app.use("/", express.static(__dirname + "/http"));
app.listen(process.env.PORT || 8080, function(){
	console.log("Listening");
});*/

function onRequest(req,res){
res.writeHead(200, {
'Access-Control-Allow-Origin' : '*'
});
};

//server.listen(443);

var pool      =    mysql.createPool({
    connectionLimit : 100, //important
    host     : '35.187.104.229',
    user     : 'visitor',
    password : 'VisitMe1234',
    database : 'PrinterMap',
    debug    :  false
});

var canQuery = true;
var sessionData = [];

function handle_database(ses, sql,tag) {
    
    pool.getConnection(function(err,connection){
        if (err) {
        	console.log("Client "+ses+" had an error connecting to database (code 100).");
			if(typeof clients[ses] != 'undefined'){
			  clients[ses].emit("serverError",{
				code : 100,
				status : "Error in connection to database",
				tags: ["db","connection"]
			  });
			}
          	return;
        }   

        //console.log('connected as id ' + connection.threadId);
        
        connection.query(sql,function(err,rows){
            connection.release();
            if(!err) {
            	console.log("Client "+ses+" received "+rows.length+" row(s) from database.");
		    if(typeof clients[ses] != 'undefined'){
			clients[ses].emit(tag,rows);
			console.log("Emitting row(s) to "+clients[ses].id);
		    }
            }
            else {
		    if(typeof clients[ses] != 'undefined'){
		    	console.log("Client "+ses+" had an error performing a database query (code 400).");
			clients[ses].emit("serverError",{
				code : 400,
				status : "Error performing query",
				tags: ["db","query"]
			});
		    }
            }           
        });

        connection.on('error', function(err) {  
		if(typeof clients[ses] != 'undefined'){
			console.log("Client "+ses+" had an error connecting to database (code 100).");
		      clients[ses].emit("serverError",{
			code : 100,
			status : "Error in connection to database",
			tags: ["db","connection"]
		      });
		}
              return;     
        });
  });
}

function handle_database_multi(ses, queries, zoom) {
    
    pool.getConnection(function(err,connection){
        if (err) {
		if(typeof clients[ses] != 'undefined'){
			console.log("Client "+ses+" had an error connecting to database (code 100).");
			  clients[ses].emit("serverError",{
				code : 100,
				status : "Error in connection to database",
				tags: ["db","connection"]
			  });
		}
          return;
        }   

        //console.log('connected as id ' + connection.threadId);

        var result = [];

        var finalRows = [];
        for(i = 0; i < queries.length; i++){
        	connection.query(queries[i],function(err,rows){
        		if(!err){
				if(typeof clients[ses] != 'undefined'){
					if(i == 0){
						clients[ses].emit("removeMarkers");
						console.log("Client "+ses+" was asked to remove all markers.");
					}
					if(!clients[ses].canQuery){
						console.log("Client "+ses+" is unable to query, terminating queries...");
						i = queries.length;
						clients[ses].canQuery = true;
						//return;
					}
					else {
						console.log("Client "+ses+" has received "+rows.length+" rows from database.");
						var filteredRows = filterRows(rows, zoom);
						var isLast = (i == queries.length) ? true : false;
						clients[ses].emit("getCluster",filteredRows,isLast);
					}
					if(i+1 == queries.length){
						console.log("Client "+ses+" was asked to merge all clusters.");
						clients[ses].emit("mergeFakeClusters","");
					}
				}
        		}
        		else {
				if(typeof clients[ses] != 'undefined'){
					console.log("Client "+ses+" had an error performing database query (code 400).");
					clients[ses].emit("serverError",{
						code : 400,
						status : "Error performing query",
						tags: ["db","query"]
					});
				}
        		}
        	});
        }
        //res.send();

  		var resultJSON = JSON.stringify(result);
        
        connection.release();
        //res.write(resultJSON);
        /*
        connection.query(sql,function(err,rows){
            connection.release();
            if(!err) {
                res.json(rows);
            }           
        });
*/
        connection.on('error', function(err) {      
		if(typeof clients[ses] != 'undefined'){
			console.log("Client "+ses+" had an error connecting to database (code 100).");
		      clients[ses].emit("serverError",{
			code : 100,
			status : "Error in connection to database",
			tags: ["db","connection"]
		      });
		}
              return;     
        });
  });
}

function filterRows(rows, zoom){
	var retRows = [];
	var z = zoom;
	if (z == 0) z = 0.1;
	var mergeDistance = -1.082 * z + 6.414;
	for(i = 0; i < rows.length; i++){
		for(n = i+1; n < rows.length; n++){
			var latOne = rows[i]["lat"];
			var lngOne = rows[i]["lng"];
			var countOne = rows[i]["count"];
			var countryOne = rows[i]["country"];
			var latTwo = rows[n]["lat"];
			var lngTwo = rows[n]["lng"];
			var countTwo = rows[n]["count"];
			var countryTwo = rows[n]["country"];

			var markerDist = (Math.abs(latOne - latTwo) + Math.abs(lngOne - lngTwo)) / 2;

			if(markerDist < mergeDistance){
				var newLat = (latOne + latTwo) / 2;
				var newLng = (lngOne + lngTwo) / 2;
				var newCount = countOne + countTwo;
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
	// Push non-empty markers to array, also remove markers with low count
	for(i = 0; i < rows.length; i++){
		if(rows[i]["lat"] != null && rows[i]["count"] > 4){
			retRows.push(rows[i]);
		}
	}
	return retRows;
}

function test_function(req,res,msg){
	console.log("Test: "+msg);
}

function getCount(ses, bounds){
	var b = bounds;
	var startLat = b.latA;
	var startLng = b.lngA;
	var endLat = b.latB;
	var endLng = b.lngB;

	var sql = "SELECT COUNT(*) AS count FROM libraries";
	sql += " WHERE lat > "+startLat;
	sql += " AND lat < "+endLat;
	sql += " AND lng > "+startLng;
	sql += " AND lng < "+endLng;

	handle_database(ses, sql,"countLibraries");
}

function getLibs(ses, bounds){
	var b = bounds;
	var startLat = b.latA;
	var startLng = b.lngA;
	var endLat = b.latB;
	var endLng = b.lngB;

	var sql = "SELECT name,lat,lng FROM libraries";
	sql += " WHERE lat > "+startLat;
	sql += " AND lat < "+endLat;
	sql += " AND lng > "+startLng;
	sql += " AND lng < "+endLng;

	handle_database(ses, sql, "getLibraries");
}

function getClusters(ses, bounds, zoom){
	var b = bounds;
	var startLat = b.latA;
	var startLng = b.lngA;
	var endLat = b.latB;
	var endLng = b.lngB;
	var gridsize = b.gridsize;

	var queries = [];

	for(i = 0; i < gridsize; i++){
		for(n = 0; n < gridsize; n++){
			var latDist = endLat - startLat;
			var lngDist = endLng - startLng;
			var latGridDist = latDist / gridsize;
			var lngGridDist = lngDist / gridsize;
			var latA = startLat + (i * latGridDist);
			var latB = latA + latGridDist;
			var lngA = startLng + (n * lngGridDist);
			var lngB = lngA + lngGridDist;

			var whereGroup = " WHERE lat > "+latA;
			whereGroup += " AND lat < "+latB;
			whereGroup += " AND lng > "+lngA;
			whereGroup += " AND lng < "+lngB;

			var sql = "SELECT AVG(lat) as lat, AVG(lng) as lng, COUNT(*) as count, country";
			sql += " FROM libraries";
			sql += whereGroup;
			sql += " GROUP BY country";

			//handle_database(req,res,sql);
			//console.log(sql+"\n");
			queries.push(sql);
		}
	}/*
	for(i = 0; i < gridsize; i++){
		for(n = 0; n < gridsize; n++){
			var latDist = endLat - startLat;
			var lngDist = endLng - startLng;
			var latGridDist = latDist / gridsize;
			var lngGridDist = lngDist / gridsize;
			var latA = startLat + (i * latGridDist);
			var latB = latA + latGridDist;
			var lngA = startLng + (n * lngGridDist);
			var lngB = lngA + lngGridDist;

			var whereGroup = " WHERE lat > "+latA;
			whereGroup += " AND lat < "+latB;
			whereGroup += " AND lng > "+lngA;
			whereGroup += " AND lng < "+lngB;

			var sql = "SELECT lat, lng, (";
				sql += "SELECT COUNT(*) FROM libraries";
				sql += whereGroup;
			sql += ") AS count FROM libraries";
			sql += whereGroup;
			sql += " ORDER BY ABS (lat - (";
				sql += "SELECT AVG(lat) FROM libraries";
				sql += whereGroup;
			sql += (")), ABS (lng - (");
				sql += "SELECT AVG(lng) FROM libraries";
				sql += whereGroup;
			sql += ")) LIMIT 1";

			//handle_database(req,res,sql);
			//console.log(sql+"\n");
			queries.push(sql);
		}
	}*/
	handle_database_multi(ses, queries, zoom);
}
/*
app.get("/",function(req,res){-
        handle_database(req,res);
});
app.get("/count",function(req,res){
	getCount(req,res);
})
app.get("/get",function(req,res){
	getLibs(req,res);
})
app.get("/clusters",function(req,res){
	getClusters(req,res);
})
app.get("/test",function(req,res){
	var msg = req.query.msg;
	test_function(req,res,msg);
})
*/
io.on('connection', function (socket) {
	console.info("New client connected (id=" + socket.id + ").");
	clients[socket.id] = socket;
	clients[socket.id].canQuery = true;
	clients[socket.id].emit("SessionID", socket.id, socket.id);
  
  socket.on('getCount', function (ses, bounds) {
  	var b = correctBounds(bounds);
  	getCount(ses, b);
  });
  socket.on('getLibraries', function (ses, bounds){
  	var b = correctBounds(bounds);
  	getLibs(ses, b);
  });
  socket.on('getClusters', function (ses, bounds, zoom){
  	var b = correctBounds(bounds);
  	b.gridsize = bounds.gridsize;
  	getClusters(ses, b, zoom);
  });
  socket.on('stopEverything', function (ses){
	  if(typeof clients[ses] != 'undefined'){
		clients[ses].canQuery = false;
		clients[ses].emit('removeMarkers');
	  }
  });
  socket.on('disconnect', function () { 
  	var index = clients[socket.id];
  	if (index != -1){
  		delete clients[socket.id];
  		console.info("Client gone (id=" + socket.id + ").");
  	}
  });
});

/*var po = 1337;
server.listen(1337, function(){
console.log("Listening to port "+po);
});*/

function correctBounds(bounds){
	var retBounds = {};
	var b = bounds;
	
	// Firstly, parse all bounds as float
	b.latA = parseFloat(b.latA);
	b.latB = parseFloat(b.latB);
	b.lngA = parseFloat(b.lngA);
	b.lngB = parseFloat(b.lngB);

	// Check if latA has the lowest value, swap the lats if not
	retBounds.latA = Math.min(b.latA,b.latB);
	retBounds.lngA = Math.min(b.lngA,b.lngB);
	retBounds.latB = Math.max(b.latA,b.latB);
	retBounds.lngB = Math.max(b.lngA,b.lngB);
	var latDist = retBounds.latB-retBounds.latA;
	var lngDist = retBounds.lngB-retBounds.lngA;
	retBounds.latA -= (latDist*0.3);
	retBounds.lngA -= (lngDist*0.3);
	retBounds.latB += (latDist*0.3);
	retBounds.lngB += (lngDist*0.3);
	/*if(b.latA > b.latB){
		retBounds.latA = b.latB;
		retBounds.latB = b.latA;
	}
	else {
		retBounds.latA = b.latA;
		retBounds.latB = b.latB;
	}

	// Check if lngA has the lowest value, swap the lngs if not
	if(b.lngA > b.lngB){
		retBounds.lngA = b.lngB;
		retBounds.lngB = b.lngA;
	}
	else {
		retBounds.lngA = b.lngA;
		retBounds.lngB = b.lngB;
	}*/

	return retBounds;
}
