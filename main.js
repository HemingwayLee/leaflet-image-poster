var leafletImage = require('leaflet-image');

var map = initMap();

// Add snapshot listener
document.getElementById('snap').addEventListener('click', function() {
    leafletImage(map, function(err, canvas) {
        var img = document.createElement('img');
        var dimensions = map.getSize();
        img.width = dimensions.x;
        img.height = dimensions.y;
        img.src = canvas.toDataURL();
        var snapshot = document.getElementById('snapshot');
        snapshot.innerHTML = '';
        snapshot.appendChild(img);
    });
});

function initMap() {
    var resolutions = [4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250, 1000, 750, 650, 500, 250, 100, 50, 20, 10, 5];

    var center = [660000, 185000];
    var bounds = [[420000, 30000], [900000, 350000]];
    var origin = [420000, 350000];

    // Definition for projected coordinate system CH1903 / LV03
    // Source: https://epsg.io/21781.js
    var crs = new L.Proj.CRS('EPSG:21781', '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs', {
        resolutions: resolutions,
        origin: origin
    });

    var unproject = function(p) {
        return crs.projection.unproject(L.point(p[0], p[1]));
    };

    var scale = function(zoom) {
        return 1 / resolutions[zoom];
    };

    var map = L.map('map', {
        crs: crs,
        maxBounds: L.latLngBounds(unproject(bounds[0]), unproject(bounds[1])),
        scale: scale
    }).setView(unproject(center), 15);

    var tileLayer = L.tileLayer('https://wmts6.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/21781/{z}/{y}/{x}.jpeg', {
        maxZoom: resolutions.length - 1,
        minZoom: 15,
        attribution: 'Map data &copy; swisstopo'
    });
    map.addLayer(tileLayer);

    return map;
}
