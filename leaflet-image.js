var queue = require('./queue');

// leaflet-image
module.exports = function leafletImage(map, width, height, callback) {

    var layerQueue = new queue(1);

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');

    // dummy canvas image when loadTile get 404 error
    // and layer don't have errorTileUrl
    var dummycanvas = document.createElement('canvas');
    dummycanvas.width = 1;
    dummycanvas.height = 1;
    var dummyctx = dummycanvas.getContext('2d');
    dummyctx.fillStyle = 'rgba(0,0,0,0)';
    dummyctx.fillRect(0, 0, 1, 1);

    map.eachLayer(drawTileLayer);
    layerQueue.awaitAll(layersDone);

    function drawTileLayer(l) {
        if (l instanceof L.TileLayer) layerQueue.defer(handleTileLayer, l);
    }

    function done() {
        callback(null, canvas);
    }

    function layersDone(err, layers) {
        if (err) throw err;
        layers.forEach(function(layer) {
            if (layer && layer.canvas) {
                ctx.drawImage(layer.canvas, 0, 0);
            }
        });
        done();
    }

    function handleTileLayer(layer, callback) {
        var isCanvasLayer = (layer instanceof L.TileLayer.Canvas),
            canvas = document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;

        var ctx = canvas.getContext('2d'),
            size = map.getSize(),
            bounds = map.getPixelBounds(),
            origin = map.getPixelOrigin(),
            zoom = map.getZoom(),
            tileSize = layer.options.tileSize;

        if (zoom > layer.options.maxZoom ||
            zoom < layer.options.minZoom ||
            (layer.options.format && !layer.options.tiles)) {
            return callback();
        }

        var sizeDiff = L.point(width, height).subtract(size).divideBy(2);

        var newBounds = {
            min: bounds.min.subtract(sizeDiff),
            max: bounds.max.add(sizeDiff)
        };

        var offset = new L.Point(
            ((origin.x / tileSize) - Math.floor(origin.x / tileSize)) * tileSize,
            ((origin.y / tileSize) - Math.floor(origin.y / tileSize)) * tileSize
        );

        var tileBounds = L.bounds(
            newBounds.min.divideBy(tileSize)._floor(),
            newBounds.max.divideBy(tileSize)._floor()),
            tiles = [],
            center = tileBounds.getCenter(),
            j, i, point,
            tileQueue = new queue(1);

        for (j = tileBounds.min.y; j <= tileBounds.max.y; j++) {
            for (i = tileBounds.min.x; i <= tileBounds.max.x; i++) {
                tiles.push(new L.Point(i, j));
            }
        }

        tiles.forEach(function(tilePoint) {
            var originalTilePoint = tilePoint.clone();

            if (layer._adjustTilePoint) {
                layer._adjustTilePoint(tilePoint);
            }

            var tilePos = layer._getTilePos(originalTilePoint)
                .subtract(newBounds.min)
                .add(origin);

            if (tilePoint.y >= 0) {
                if (isCanvasLayer) {
                    var tile = layer._tiles[tilePoint.x + ':' + tilePoint.y];
                    tileQueue.defer(canvasTile, tile, tilePos, tileSize);
                } else {
                    var url = addCacheString(layer.getTileUrl(tilePoint));
                    tileQueue.defer(loadTile, url, tilePos, tileSize);
                }
            }
        });

        tileQueue.awaitAll(tileQueueFinish);

        function canvasTile(tile, tilePos, tileSize, callback) {
            callback(null, {
                img: tile,
                pos: tilePos,
                size: tileSize
            });
        }

        function loadTile(url, tilePos, tileSize, callback) {
            var im = new Image();
            im.crossOrigin = '';
            im.onload = function() {
                callback(null, {
                    img: this,
                    pos: tilePos,
                    size: tileSize
                });
            };
            im.onerror = function(e) {
                // use canvas instead of errorTileUrl if errorTileUrl get 404
                if (layer.options.errorTileUrl != '' && e.target.errorCheck === undefined) {
                    e.target.errorCheck = true;
                    e.target.src = layer.options.errorTileUrl;
                } else {
                    callback(null, {
                        img: dummycanvas,
                        pos: tilePos,
                        size: tileSize
                    });
                }
            };
            im.src = url;
        }

        function tileQueueFinish(err, data) {
            data.forEach(drawTile);
            callback(null, { canvas: canvas });
        }

        function drawTile(d) {
            ctx.drawImage(d.img, Math.floor(d.pos.x), Math.floor(d.pos.y),
                d.size, d.size);
        }
    }

    function addCacheString(url) {
        return url + ((url.match(/\?/)) ? '&' : '?') + 'cache=' + (+new Date());
    }
};
