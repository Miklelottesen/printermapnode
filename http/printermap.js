// TODO: All of this code desperately needs refactoring. Sorry, I ran out of time..

var userPosition = [];
var userIp;
var map;
var service;
var infowindow;
var currentBounds;
var isFirstRun = true;
var detectionLimit = 0; // How much of the view has to be moved in order to update markers
var offlineMarkers = [];
var onlineMarkers = [];
var fakeClusterMarkers = [];
var markerCluster;
var princhMarkerCluster;
var lastMarker;
var nodeUrl;
var socket;
var lastCount;
var countLimit = 2000;
var clusterGridSize = 2;
var searchTimer;
var startLocation;
var userMarker;

function initMap() {
    nodeUrl = setNodeURL();
    // Get user's location based on IP lookup
    $.getJSON("https://geoip-db.com/json/geoip.php?jsonp=?")
        .done(function(location) {
            startLocation = location;
            startApp(location);
        })
        .fail(function() {
            var fakeStartLocation = createFakeStartLocation();
            startLocation = fakeStartLocation;
            startApp(fakeStartLocation);
        });
}

function setNodeURL() {
    var windowUrl = window.location.href;
    var urlScheme = getUrlScheme(windowUrl);
    var urlHost = getUrlHostAndPath(windowUrl);
    urlHost = handlePort(urlHost);

    var constructedUrl = urlScheme + urlHost;
    console.log(constructedUrl);
    return constructedUrl;
}

function handlePort(urlHost) {
    if (urlHost.split(":").length > 1) {
        return urlHost.split(":")[0] + ":8080";
    } else if (windowUrl.split("/").length > 1) {
        var newUrl = "";
        for (i = 0; i < urlHost.split("/").length; i++) {
            newUrl += urlHost.split("/")[i];
            if (i + 1 !== urlHost.split("/").length) {
                newUrl += "/";
            }
        }
        return newUrl;
    } else {
        return urlHost;
    }
}

function getUrlHostAndPath(url) {
    return url.split("://")[1];
}

function getUrlScheme(url) {
    return url.split("://")[0] + "://";
}

function initializeSearchListeners() {
    $("#searchQuery").on("change paste keyup keypress", function(e) {
        if(!handleEnterKeypress(e, function(){
            imFeelingLucky();
        }))
            handleSearchFieldInputChanges();
    });
    $("#cancelSearch").click(function() {
        clearSearchResults(true);
    });
    $("#doSearch").click(function() {
        imFeelingLucky();
    });
}

function handleEnterKeypress(event, action){
    if(event.which === 13) // 13 = Enter
    {
        action();
        return true;
    }
    return false;
}

function handleSearchFieldInputChanges(){
    if ($("#searchQuery").val() === "")
        clearSearchResults(true);
    else
        restartSearchTypingTimer();
    toggleCancelButton();
}

function buildPrinchRestUrl() {
    var url = "https://rest.princh.com/printer?latitude=";
    url += map.getCenter().lat();
    url += "&longitude=";
    url += map.getCenter().lng();
    url += "&radius=" + (Math.floor(16000 / map.getZoom()));
    return url;
}

function getPrinchLocations() {
    var restUrl = buildPrinchRestUrl();
    $.getJSON(restUrl, {}, function(data) {
        makePrinchMarkers(data);
    });
}

function imFeelingLucky() {
    var searchLocation = new google.maps.LatLng(startLocation.latitude, startLocation.longitude);
    var searchQuery = $("#searchQuery").val();
    var request = createSearchRequest(searchLocation, searchQuery);
    if (searchQuery !== "")
        service.textSearch(request, imFeelingLuckyCallback);
}

function imFeelingLuckyCallback(results, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {

        var locationCoordinates = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
        };
        map.setCenter(new google.maps.LatLng(
            locationCoordinates.lat,
            locationCoordinates.lng));
        map.setZoom(15);
        setUserPosition({
            coords: {
                latitude: locationCoordinates.lat,
                longitude: locationCoordinates.lng
            }
        });
        clearSearchResults(true);
        window.setTimeout(function() {
            // Workaround for moronically quick users
            clearSearchResults(true);
        }, 15);
    }
}

function toggleCancelButton() {
    if ($("#searchQuery").val() === "") {
        displayCancelBtn(false);
    } else {
        displayCancelBtn(true);
    }
}

function displayCancelBtn(display) {
    if (display && $("#cancelSearch").hasClass("hidden")) {
        $("#cancelSearch").removeClass("hidden");
    } else if (!display && !$("#cancelSearch").hasClass("hidden")) {
        $("#cancelSearch").addClass("hidden");
    }
}

function searchFieldLoadingSpinnerToggle(showSpinner) {
    console.log("Spinnerchange");
    $("#cancelSearch").empty();
    if (showSpinner) {
        $("#cancelSearch").append("<img src=\"/imgs/ring.gif\">");
    } else {
        $("#cancelSearch").append("X");
    }
}

function restartSearchTypingTimer() {
    stopSearchTimer();
    searchFieldLoadingSpinnerToggle(true);
    searchTimer = window.setTimeout(function() {
        var searchQuery = $("#searchQuery").val();
        console.log(startLocation);
        var searchLocation = new google.maps.LatLng(startLocation.latitude, startLocation.longitude);
        var request = createSearchRequest(searchLocation, searchQuery);
        service.textSearch(request, onTextSearch);
        searchFieldLoadingSpinnerToggle(false);
    }, 300);
}

function createSearchRequest(location, query) {
    return {
        location: location,
        radius: 2000,
        query: query
    };
}

function stopSearchTimer() {
    if (typeof searchTimer !== null) {
        window.clearTimeout(searchTimer);
        searchTimer = null;
        searchFieldLoadingSpinnerToggle(false);
    }
}

function onTextSearch(results, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
        clearSearchResults(false);
        var searchResultsLimit = 11;
        if (results.length < searchResultsLimit) searchResultsLimit = results.length;
        createSearchResults(results);
    }
}

function createSearchResults(results) {
    for (i = 0; i < searchResultsLimit; i++) {
        var imgSrc = results[i].icon;
        var resName = shortenString(results[i].name, 46);
        var resAddr = shortenString(results[i].formatted_address, 70);
        var txt = "<b>" + resName + "</b><br>";
        txt += resAddr;
        var coords = {
            lat: results[i].geometry.location.lat(),
            lng: results[i].geometry.location.lng()
        };
        var id = results[i].id;
        var tooltip = results[i].name;
        $("#searchResults").append(constructSearchResultHTML(id, imgSrc, txt, coords, tooltip));
        $("#" + id).click(function() {
            map.setCenter(new google.maps.LatLng(
                coords.lat,
                coords.lng));
            map.setZoom(15);
            setUserPosition({
                coords: {
                    latitude: coords.lat,
                    longitude: coords.lng
                }
            });
            clearSearchResults(true);
        });
    }
}

function shortenString(str, len) {
    if (str.length >= len) {
        var s = str.substring(0, len);
        s = s.trim();
        s += "...";
        return s;
    }
    return str;
}

function clearSearchResults(clearSearchBox) {
    $("#searchResults").empty();
    if (clearSearchBox) {
        stopSearchTimer();
        $("#searchQuery").val("");
    }
    toggleCancelButton();
    searchFieldLoadingSpinnerToggle(false);
}

function constructSearchResultHTML(id, imgSrc, txt, coords, tooltip) {
    var ret = '<div title="' + tooltip + '" id="' + id + '" data-lat="' + coords.lat + '" data-lng="' + coords.lng + '" class="searchResult">';
    ret += '<img src="' + imgSrc + '"><p>' + txt + '</p>';
    ret += '</div>';
    return ret;
}

function createFakeStartLocation() {
    return {
        latitude: 55.676098,
        longitude: 12.568337,
        IPv4: null
    };
}

function startApp(startLocation) {
    // Start socket.io connection
    var options = {
        forceNew: true,
        reconnection: false,
        timeout: 10000,
        "flash policy port": 8080,
        autoConnect: true,
        "path": "/node_modules/socket.io",
        "transports": ["polling"]
    }
    socket = io.connect(nodeUrl);
    socket.on('connect', function() {
        socket.on('message', function(msg) {
            console.log(msg);
        });

        socket.on("countLibraries", function(rows) {
            onCountLibraries(rows);
        });
        socket.on("getLibraries", function(rows) {
            onGetLibraries(rows);
        });
        socket.on("getCluster", function(rows) {
            //console.log("Getting clusters!");
            onGetClusterMarker(rows);
            //if(isLast) console.log("Merge markers");
        });
        socket.on("removeMarkers", function() {
            removeAllMarkers();
        })
        socket.on("mergeFakeClusters", function(empty) {
            console.log("Duh");
            filterRows();
        });
        socket.on("serverError", function(err) {
            console.log(err.status);
        })
    });

    userPosition = [startLocation.latitude, startLocation.longitude];
    var userPos = new google.maps.LatLng(userPosition[0], userPosition[1]);
    userIp = startLocation.IPv4;
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 5,
        center: userPos,
        streetViewControl: false,
        mapTypeControl: false
    });
    map.addListener("bounds_changed", function() {
        boundsChanged();
    });
    map.addListener("zoom_changed", function() {
        isFirstRun = true;
        console.log("Zoom: " + map.getZoom());
        boundsChanged();
    });
    service = new google.maps.places.PlacesService(map);
    initializeSearchListeners();
    // Attempt to get user's physical position
    getLocation();
    getPrinchLocations();
    // TODO: implement!
    /*var marker = new google.maps.Marker({
        position: userPos,
        map: map
    });   */
}

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
            startLocation.latitude = pos.coords.latitude;
            startLocation.longitude = pos.coords.longitude;
            setUserPosition(pos);
        });
    }
}

function setUserPosition(pos) {
    var userPos = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
    if (typeof userMarker != "undefined") {
        userMarker.setMap(null);
        userMarker = null;
    }
    userMarker = new google.maps.Marker({
        position: userPos,
        map: map
    });
}

function onCountLibraries(rows) {
    lastCount = rows[0]["count"];
    if (lastCount < countLimit) {
        // Sufficiently few, get markers
        socket.emit("getLibraries", constructNodeBoundsObject());
    } else {
        // Too many printers, get clusters
        removeAllMarkers();
        var nbog = constructNodeBoundsObjectGridsize();
        var nbz = map.getZoom();
        console.log("Clusterdata: \n" + JSON.stringify(nbog) + "\n" + JSON.stringify(nbz));
        socket.emit("getClusters", nbog, nbz);
    }
}

function onGetLibraries(rows) {
    removeAllMarkers();
    console.log(rows.length + " markers received");
    for (i = 0; i < rows.length; i++) {
        var lName = rows[i]["name"];
        var lLat = rows[i]["lat"];
        var lLng = rows[i]["lng"];
        var lPos = {
            lat: lLat,
            lng: lLng
        };
        var lAddr = rows[i]["address"];
        constructMarker(lPos, lName, lAddr);
    }
    //removeOverlappingLocations();
    //console.log(onlineMarkers[0]);
    reloadClustering();
}

function makePrinchMarkers(data) {
    removeAllPrinchMarkers();
    for (i = 0; i < data.length; i++) {
        var pos = new google.maps.LatLng(data[i].location.latitude, data[i].location.longitude);
        var title = data[i].description.name;
        var address = data[i].location.address;
        constructPrinchMarker(pos, title, address, data[i]);
    }
    reloadPrinchClustering();
    removeOverlappingLocations();
}

function onGetClusterMarker(rows) {
    //removeAllMarkers();
    /*for(i = 0; i < rows.length; i++){
      //console.log(rows[i]);
        var r = rows[i];
        var lLat = r["lat"];
        var lLng = r["lng"];
        var lCount = r["count"];
        var lPos = {lat: lLat, lng: lLng};
        /*var lBounds = {
            ne: {
                lat: r["endLat"],
                lng: r["endLng"]
            },
            sw: {
                lat: r["startLat"],
                lng: r["startLng"]
            }
        };*/
    /*var lBounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(r["startLat"],r["startLng"]),
            new google.maps.LatLng(r["endLat"],r["endLng"])
        );
        constructFakeClusterMarker(lPos,lCount, lBounds);
    }*/
    rows.forEach(function(row) {
        var position = {
            lat: row.lat,
            lng: row.lng
        };
        var bounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(row.startLat, row.startLng),
            new google.maps.LatLng(row.endLat, row.endLng)
        );
        console.log("Constructing marker: " + position.lat + " x " + position.lng);
        var cent = map.getBounds().getCenter();
        console.log("     Map center is:       " + cent.lat() + " x " + cent.lng());
        constructFakeClusterMarker(position, row.count, bounds);
    });
}

function boundsChanged() {
    detectionLimit = 0.3;
    var bounds = map.getBounds();
    var newBounds = constructBoundsObject(bounds);
    if (isFirstRun) {
        currentBounds = newBounds;
        isFirstRun = false;
        getPrinterCount();
    }
    var bLimitLat = (newBounds.sw.lat - newBounds.ne.lat) * detectionLimit;
    var bLimitLng = (newBounds.ne.lng - newBounds.sw.lng) * detectionLimit;
    bLimitLat = (bLimitLat < 0) ? bLimitLat * -1 : bLimitLat;
    bLimitLng = (bLimitLng < 0) ? bLimitLng * -1 : bLimitLng;

    // Check if the difference between old bounds and new bounds is too big
    var cB = currentBounds.ne;
    var nB = newBounds.ne;
    if ((cB.lat - nB.lat <= (bLimitLat * -1) || cB.lat - nB.lat >= bLimitLat) || (cB.lng - nB.lng <= (bLimitLng * -1) || cB.lng - nB.lng >= bLimitLng)) {
        // Bounds changed sufficiently
        socket.emit("stopEverything");
        currentBounds = newBounds;
        // Get printerCount
        getPrinterCount();
    }
    detectionLimit = 0;
}

function constructBoundsObject(bounds) {
    var boundsArr = [bounds.getNorthEast(), bounds.getSouthWest()];
    return {
        ne: {
            lat: boundsArr[0].lat(),
            lng: boundsArr[0].lng()
        },
        sw: {
            lat: boundsArr[1].lat(),
            lng: boundsArr[1].lng()
        }
    };
}

function constructNodeBoundsObject() {
    return {
        latA: currentBounds.ne.lat,
        latB: currentBounds.sw.lat,
        lngA: currentBounds.ne.lng,
        lngB: currentBounds.sw.lng
    };
}

function constructNodeBoundsObjectGridsize() {
    return {
        latA: currentBounds.ne.lat,
        latB: currentBounds.sw.lat,
        lngA: currentBounds.ne.lng,
        lngB: currentBounds.sw.lng,
        gridsize: clusterGridSize,
        zoom: map.getZoom()
    };
}

function getPrinterCount() {
    console.log("Countdata: \n" + JSON.stringify(constructNodeBoundsObject()));
    socket.emit("getCount", constructNodeBoundsObject());
}

function constructPrinchMarker(pos, title, address, obj) {
    if (pos.lat() > 70) return false;
    var image = {
        url: '/imgs/markerP.png',
        // This marker is 20 pixels wide by 32 pixels high.
        size: new google.maps.Size(25, 38),
        // The origin for this image is (0, 0).
        origin: new google.maps.Point(0, 0),
        // The anchor for this image is the base of the flagpole at (0, 32).
        anchor: new google.maps.Point(12, 38)
    };
    var parser = new DOMParser;
    var domName = parser.parseFromString(
        '<!doctype html><body>' + title,
        'text/html');
    var decodedName = domName.body.textContent;
    var marker = new google.maps.Marker({
        position: pos,
        icon: image,
        title: decodeString(title),
        map: map,
        name: title,
        address: address,
        printerdata: obj
    });
    var aSplit = address.split(" - ");
    address = aSplit[0];
    marker.addListener('click', function() {
        //console.log(marker.getPosition());
        lastMarker = marker;

        var domAddr = parser.parseFromString(
            '<!doctype html><body>' + address,
            'text/html');

        var decodedAddres = domAddr.body.textContent;
        var request = {
            location: marker.getPosition(),
            radius: 5000,
            keyword: decodeString(address),
            name: decodeString(title)
        };
        //console.log(request);
        //console.log(address);
        console.log(pos.lat());
        service.nearbySearch(request, function callback(results, status) {
            onNearbySearchPrinch(results, status, marker);
        });
    });
    //marker.setMap(map);
    onlineMarkers.push(marker);
}

function constructMarker(pos, title, address) {
    //if (isAlreadyPrinchLocation(pos)) return false;
    var image = {
        url: '/imgs/markerO.png',
        // This marker is 20 pixels wide by 32 pixels high.
        size: new google.maps.Size(25, 25),
        // The origin for this image is (0, 0).
        origin: new google.maps.Point(0, 0),
        // The anchor for this image is the base of the flagpole at (0, 32).
        anchor: new google.maps.Point(12, 13)
    };
    var parser = new DOMParser;
    var domName = parser.parseFromString(
        '<!doctype html><body>' + title,
        'text/html');
    var decodedName = domName.body.textContent;
    var marker = new google.maps.Marker({
        position: pos,
        icon: image,
        title: decodeString(title),
        map: map,
        name: title,
        address: address
    });
    var aSplit = address.split(" - ");
    address = aSplit[0];
    marker.addListener('click', function() {
        //console.log(marker.getPosition());
        lastMarker = marker;

        var domAddr = parser.parseFromString(
            '<!doctype html><body>' + address,
            'text/html');

        var decodedAddres = domAddr.body.textContent;
        var request = {
            location: marker.getPosition(),
            radius: 5000,
            keyword: decodeString(address),
            name: decodeString(title)
        };
        console.log(request);
        //console.log(address);
        service.nearbySearch(request, function callback(results, status) {
            onNearbySearch(results, status, marker);
        });
    });
    //marker.setMap(map);
    offlineMarkers.push(marker);
}

function decodeString(str) {
    var parser = new DOMParser;
    var dom = parser.parseFromString(
        '<!doctype html><body>' + str,
        'text/html');
    return dom.body.textContent;
}

function onNearbySearch(results, status, marker) {
    console.log(status);
    console.log(results);
    if (status == google.maps.places.PlacesServiceStatus.OK) {
        //console.log(results[0]['place_id']);
        var pID = results[0]['place_id'];
        service.getDetails({
            placeId: pID
        }, onGetPlaceDetails);
    } else {
        // No results from search, use (limited) marker info instead:
        var place = {
            name: marker.name,
            formatted_address: marker.address
        };
        makeNonPrinchInfoWindow(place, marker);
    }
}

function onNearbySearchPrinch(results, status, marker) {
    console.log(marker.printerdata);
    if (status == google.maps.places.PlacesServiceStatus.OK) {
        var pID = results[0]['place_id'];
        service.getDetails({
            placeId: pID
        }, function(place, status) {
            makePrinchInfoWindow(place, marker);
        });
    } else {
        var place = {
            name: marker.printerdata.description.name,
            formatted_address: marker.printerdata.location.address
        };
        makePrinchInfoWindow(place, marker);
    }
}

function onGetPlaceDetails(place, status) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {
        console.log(place);
        makeNonPrinchInfoWindow(place, lastMarker);
    }
}

function makePrinchInfoWindow(place, marker) {
    /*
    Possible properties:
        - name
        - formatted_address (split by ", ")
        - international_phone_number
        - url (Google page)
        - website (own website url)
        - opening_hours
            - open_now (bool)
            - weekday_text
                - [n] (capitalize first letter)
        - photos
            - [n]
                - getUrl(maxWidth)
    */
    // TODO: This section is copied directly from makeNonPrinchInfoWindow, and should be changed to have a better formatted address, along with info from the Princh backend
    var html = "";

    html += handleHeading(place['name'], marker.printerdata.description.name);
    html += handleAddress(place['formatted_address']);
    html += handlePhone(place['international_phone_number']);
    html += handleUrls([{
        obj: place['url'],
        txt: "Mere info"
    }, {
        obj: place['website'],
        txt: "Besøg hjemmeside"
    }]);
    html += handleOpeningHours(place['opening_hours']);
    html += handlePhotos(place['photos']);

    infowindow = new google.maps.InfoWindow({
        content: html
    });
    infowindow.open(map, marker);

    console.log(html);
}

function makeNonPrinchInfoWindow(place, marker) {
    /*
    Possible properties:
        - name
        - formatted_address (split by ", ")
        - international_phone_number
        - url (Google page)
        - website (own website url)
        - opening_hours
            - open_now (bool)
            - weekday_text
                - [n] (capitalize first letter)
        - photos
            - [n]
                - getUrl(maxWidth)
    */
    // TODO: Better address formatting
    var html = "";

    html += handleHeading(place['name'], marker['name']);
    html += handleAddress(place['formatted_address']);
    html += handlePhone(place['international_phone_number']);
    html += handleUrls([{
        obj: place['url'],
        txt: "Mere info"
    }, {
        obj: place['website'],
        txt: "Besøg hjemmeside"
    }]);
    html += handleOpeningHours(place['opening_hours']);
    html += handlePhotos(place['photos']);

    infowindow = new google.maps.InfoWindow({
        content: html
    });
    infowindow.open(map, marker);

    console.log(html);
}

function handleHeading(prop, def) {
    var ret = "<h2>";
    ret += (propertyExists(prop)) ? prop : def;
    ret += "</h2>";
    return ret;
}

function handleAddress(prop) {
    var ret = "";

    if (propertyExists(prop)) {
        var props = prop.split(", ");
        for (i = 0; i < props.length; i++) {
            ret += "<p>" + props[i] + "</p>";
        }
    }
    return ret;
}

function handlePhone(prop) {
    if (propertyExists(prop)) {
        return "<p><b>Telefon: </b>" + prop + "</p><br>";
    } else return "";
}

function handleUrls(props) {
    var ret = "";
    for (i = 0; i < props.length; i++) {
        if (propertyExists(props.obj)) {
            ret += '<p><a target="_blank" href="' + prop.obj + '">' + prop.txt + '</a></p>';
        }
    }
    return ret;
}

function handleOpeningHours(prop) {
    if (propertyExists(prop)) {
        if (propertyExists(prop['open_now'])) {
            if (propertyExists(prop['weekday_text'])) {
                var today = new Date().getDay();
                if (today == 0) todayWeekday = 7; // JS weekdays starts with Sunday, Google's starts with Monday
                today--;
                if (propertyExists(prop['weekday_text'][today])) {
                    var openedText = 'lukket';
                    if (prop['open_now']) openedText = 'åbent';
                    var ret = "";
                    ret += "<p><b>Åbningstider: </b></p>";
                    ret += "<p>" + capitalizeFirstLetter(prop['weekday_text'][today]) + " (" + openedText + ")</p><br>";
                    return ret;
                }
            }
        }
    }
    return "";
}

function handlePhotos(prop, ind) {
    var photoProps = {
        maxWidth: 320
    }
    if (propertyExists(prop)) {
        if (propertyExists(prop[i])) {
            return "<img src=\"" + prop[i].getUrl(photoProps) + "\" />";
        }
    }
    return "";
}

function propertyExists(property) {
    return (typeof property != 'undefined') ? true : false;
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function constructFakeClusterMarker(pos, count, bounds) {
    var iconSize = 45;
    var fileName = "clusterO.png";
    if (count > 999) {
        iconSize = 50;
        fileName = "clusterO50.png";
    }
    if (count > 9999) {
        iconSize = 55;
        fileName = "clusterO55.png";
    }
    if (count > 99999) {
        iconSize = 60;
        fileName = "clusterO60.png";
    }
    var halfSize = parseInt(iconSize / 2);
    var image = {
        url: '/imgs/' + fileName,
        // This marker is 20 pixels wide by 32 pixels high.
        size: new google.maps.Size(iconSize, iconSize),
        // The origin for this image is (0, 0).
        origin: new google.maps.Point(0, 0),
        // The anchor for this image is the base of the flagpole at (0, 32).
        anchor: new google.maps.Point(halfSize, halfSize)
    };
    var nCount = count.toLocaleString();
    var newmarker = new google.maps.Marker({
        position: pos,
        label: {
            text: count.toLocaleString(),
            color: "white"
        },
        map: map,
        icon: image
    });
    //console.log(newmarker.position.lat());
    newmarker.addListener('click', function() {
        //getMarkerDistance(pos);
        /*var currentZoom = map.getZoom();
        var newZoom = currentZoom + 4;
        map.setZoom(newZoom);
        map.setCenter(newmarker.getPosition());*/
        console.log(bounds);
        console.log(map.getBounds());
        map.fitBounds(bounds);

    });
    fakeClusterMarkers.push(newmarker);
}

function filterRows() {
    var retRows = [];
    var z = map.getZoom();
    if (z == 0) z = 0.1;
    var mergeDistance = -1.082 * z + 6.414;

    for (i = 0; i < fakeClusterMarkers.length; i++) {
        for (n = i + 1; n < fakeClusterMarkers.length; n++) {
            //console.log(fakeClusterMarkers[i]);
            /*var mi = fakeClusterMarkers[i];
            var mn = fakeClusterMarkers[n];
            var markerDist = (Math.abs(mi.latLng.lat() - mn.latLng.lat()) + Math.abs(mi.latLng.lng() - mn.latLng.lng())) / 2;
            if(markerDist < mergeDistance){
                // Merge the two markers by deleting them and creating a new
                var newLat = (mi.latLng.lat() + mn.latLng.lng()) / 2;
                var newLng = (mi.latLng.lat() + mn.latLng.lng()) / 2;
            }*/
        }
    }
    if (typeof rows != "undefined")
        for (i = 0; i < rows.length; i++) {
            for (n = i + 1; n < rows.length; n++) {
                var latOne = rows[i]["lat"];
                var lngOne = rows[i]["lng"];
                var countOne = rows[i]["count"];
                var countryOne = rows[i]["country"];
                var latTwo = rows[n]["lat"];
                var lngTwo = rows[n]["lng"];
                var countTwo = rows[n]["count"];
                var countryTwo = rows[n]["country"];

                var markerDist = (Math.abs(latOne - latTwo) + Math.abs(lngOne - lngTwo)) / 2;

                if (markerDist < mergeDistance) {
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
    if (typeof rows != "undefined")
        for (i = 0; i < rows.length; i++) {
            if (rows[i]["lat"] != null && rows[i]["count"] > 4) {
                retRows.push(rows[i]);
            }
        }
    return retRows;
}

function removeAllMarkers() {
    /*if(typeof markerCluster != 'undefined'){
        for(i=0; i < markerCluster.length; i++){
            markerCluster[i].setMap(null);
        }
    }*/
    for (i = 0; i < offlineMarkers.length; i++) {
        offlineMarkers[i].setMap(null);
    }
    for (i = 0; i < fakeClusterMarkers.length; i++) {
        fakeClusterMarkers[i].setMap(null);
    }
    if (typeof markerCluster != 'undefined')
        markerCluster.clearMarkers();
    offlineMarkers = [];
    fakeClusterMarkers = [];
}

function removeAllPrinchMarkers() {
    for (i = 0; i < onlineMarkers.length; i++) {
        onlineMarkers[i].setMap(null);
    }
    if (typeof princhMarkerCluster != 'undefined')
        princhMarkerCluster.clearMarkers();
    onlineMarkers = [];
}

function reloadPrinchClustering() {
    var clusterStyles = [{
        textColor: 'white',
        url: 'imgs/clusterP.png',
        height: 45,
        width: 45
    }];
    princhMarkerCluster = new MarkerClusterer(map, onlineMarkers, {
        styles: clusterStyles,
        gridSize: 90,
        maxZoom: 15,
        minimumClusterSize: 5,
        averageCenter: true,
        zoomOnClick: true
    });
}

function reloadClustering() {
    var clusterStyles = [{
        textColor: 'white',
        url: 'imgs/clusterer/m1.png',
        height: 45,
        width: 45
    }];
    markerCluster = new MarkerClusterer(map, offlineMarkers, {
        styles: clusterStyles,
        gridSize: 90,
        maxZoom: 15,
        minimumClusterSize: 5,
        averageCenter: true,
        zoomOnClick: true
    });
}

function removeOverlappingLocations() {
    /*console.log("Removing overlaps");
    for (i = 0; i < offlineMarkers.length; i++) {
      for (n = 0; n < onlineMarkers.length; n++) {
        var latOff = offlineMarkers[i];
        console.log(latOff);
      }
    }*/
}