var leafletImage = require('./leaflet-image');
var fileSaver = require('node-safe-filesaver');

var currentCrs;
var lastView = {};

var layers = {
    'mapbox.blue-marble-topo-jan': [initMapbox, 'EPSG:3857'],
    'mapbox.blue-marble-topo-jul': [initMapbox, 'EPSG:3857'],
    'mapbox.comic': [initMapbox, 'EPSG:3857'],
    'mapbox.dark': [initMapbox, 'EPSG:3857'],
    'mapbox.emerald': [initMapbox, 'EPSG:3857'],
    'mapbox.high-contrast': [initMapbox, 'EPSG:3857'],
    'mapbox.landsat-live': [initMapbox, 'EPSG:3857'],
    'mapbox.light': [initMapbox, 'EPSG:3857'],
    'mapbox.natural-earth-2': [initMapbox, 'EPSG:3857'],
    'mapbox.outdoors': [initMapbox, 'EPSG:3857'],
    'mapbox.pencil': [initMapbox, 'EPSG:3857'],
    'mapbox.pirates': [initMapbox, 'EPSG:3857'],
    'mapbox.run-bike-hike': [initMapbox, 'EPSG:3857'],
    'mapbox.satellite': [initMapbox, 'EPSG:3857'],
    'mapbox.streets': [initMapbox, 'EPSG:3857'],
    'mapbox.wheatpaste': [initMapbox, 'EPSG:3857'],
    'toner': [initStamen, 'EPSG:3857', 'png'],
    'watercolor': [initStamen, 'EPSG:3857'],
    'ch.swisstopo.pixelkarte-farbe': [initSwisstopo, 'EPSG:21781']
}

init('mapbox.streets');

function init(layer) {
    // Init map
    setLayer(layer);

    // Init layer list
    for (var name in layers) {
        addLayer(name);
    }

    // Add snapshot listener
    document.getElementById('snap').addEventListener('click', function() {
        var width = +document.getElementById('width').value;
        var height = +document.getElementById('height').value;
        leafletImage(map, width, height, function(err, canvas) {
            canvas.toBlob(function(blob) {
                fileSaver.saveAs(blob, "map.png");
            });
        });
    });
}

function addLayer(layer) {
    var container = document.createElement('li');
    var entry = document.createElement('a');
    entry.innerHTML = layer;
    entry.className = 'layer-entry';
    entry.addEventListener('click', function() {
        lastView[currentCrs] = {
            center: map.getCenter(),
            zoom: map.getZoom()
        }
        map.remove();
        setLayer(layer);
    });
    container.appendChild(entry);
    document.getElementById('layers').appendChild(container);
}

function setLayer(layer) {
    var data = layers[layer];
    currentCrs = data[1];
    map = data[0].apply(null, [layer].concat(data.slice(2)));
}

function initMapbox(id) {
    var mbAttr = 'Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, ' +
                 '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
                 'Imagery © <a href="https://mapbox.com">Mapbox</a>';
    var mbUrl = 'https://{s}.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpandmbXliNDBjZWd2M2x6bDk3c2ZtOTkifQ._QA7i5Mpkd_m30IGElHziw';

    var map = L.map('map');

    if (lastView[currentCrs]) {
        map.setView(lastView[currentCrs].center, lastView[currentCrs].zoom);
    } else {
        map.setView([0, 0], 1);
    }

    L.tileLayer(mbUrl, {
        subdomains: 'abcd',
        maxZoom: 18,
        attribution: mbAttr,
        id: id
    }).addTo(map);

    return map;
}

function initStamen(id, imgFormat) {
    imgFormat = imgFormat ? imgFormat : 'jpg';

    var stamenAttr = 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ' +
                     'under <a href="https://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ' +
                     'Data by <a href="https://openstreetmap.org">OpenStreetMap</a>, ' +
                     'under <a href="https://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.';
    var stamenUrl = 'http://{s}.tile.stamen.com/{id}/{z}/{x}/{y}.{imgFormat}';

    var map = L.map('map');

    if (lastView[currentCrs]) {
        map.setView(lastView[currentCrs].center, lastView[currentCrs].zoom);
    } else {
        map.setView([0, 0], 1);
    }

    L.tileLayer(stamenUrl, {
        subdomains: 'abcd',
        maxZoom: 18,
        attribution: stamenAttr,
        id: id,
        imgFormat: imgFormat
    }).addTo(map);

    return map;
}

function initSwisstopo() {
    // Definition of available tiles (bounding box) and resolutions
    // Source: https://api3.geo.admin.ch/services/sdiservices.html#parameters
    var topLeft = L.point(420000, 350000);
    var bottomRight = L.point(900000, 30000);
    var center = topLeft.add(bottomRight).divideBy(2);
    var resolutions = [4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250, 1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5];

    // Definition for projected coordinate system CH1903 / LV03
    // Source: https://epsg.io/21781.js
    var crs = new L.Proj.CRS('EPSG:21781', '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs', {
        resolutions: resolutions,
        origin: [topLeft.x, topLeft.y]
    });

    var unproject = function(p) {
        return crs.projection.unproject(p);
    };

    var scale = function(zoom) {
        return 1 / resolutions[zoom];
    };

    var map = L.map('map', {
        crs: crs,
        maxBounds: L.latLngBounds(unproject(topLeft), unproject(bottomRight)),
        scale: scale
    });

    if (lastView[currentCrs]) {
        map.setView(lastView[currentCrs].center, lastView[currentCrs].zoom);
    } else {
        map.setView(unproject(center), 15);
    }

    var tileLayer = L.tileLayer('https://wmts{s}.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/21781/{z}/{y}/{x}.jpeg', {
        subdomains: ['', '5', '6', '7', '8', '9'],
        maxZoom: resolutions.length - 1,
        minZoom: 15,
        attribution: 'Map data &copy; swisstopo'
    });
    map.addLayer(tileLayer);

    return map;
}
