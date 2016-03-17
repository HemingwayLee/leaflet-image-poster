var leafletImage = require('./leaflet-image');
var fileSaver = require('node-safe-filesaver');

var map = initMap();

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

function initMap() {
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
    }).setView(unproject(center), 15);

    var tileLayer = L.tileLayer('https://wmts{s}.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/21781/{z}/{y}/{x}.jpeg', {
        subdomains: ['', '5', '6', '7', '8', '9'],
        maxZoom: resolutions.length - 1,
        minZoom: 15,
        attribution: 'Map data &copy; swisstopo'
    });
    map.addLayer(tileLayer);

    return map;
}
