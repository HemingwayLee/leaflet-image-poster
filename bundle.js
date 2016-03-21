(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
* Contains code from leaflet-image
* Copyright (c) 2015, Mapbox
* All rights reserved.
* Copyrights licensed under the Simplified BSD License.
* See the accompanying LICENSE file for terms.
*/

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
            tileQueue = new queue();

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

},{"./queue":4}],2:[function(require,module,exports){
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

},{"./leaflet-image":1,"node-safe-filesaver":3}],3:[function(require,module,exports){
/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 2015-05-07.2
 *
 * By Eli Grey, http://eligrey.com
 * License: X11/MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

var saveAs = saveAs || (function(view) {
	"use strict";
	
	// If no view just quit, probably we are in node.js
	if(typeof view === "undefined") {
	  	return;
	}
	
	// IE <10 is explicitly unsupported
	if (typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var
		  doc = view.document
		  // only get URL when necessary in case Blob.js hasn't overridden it yet
		, get_URL = function() {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function(node) {
			var event = doc.createEvent("MouseEvents");
			event.initMouseEvent(
				"click", true, false, view, 0, 0, 0, 0, 0
				, false, false, false, false, 0, null
			);
			node.dispatchEvent(event);
		}
		, webkit_req_fs = view.webkitRequestFileSystem
		, req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem
		, throw_outside = function(ex) {
			(view.setImmediate || view.setTimeout)(function() {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		, fs_min_size = 0
		// See https://code.google.com/p/chromium/issues/detail?id=375297#c7 and
		// https://github.com/eligrey/FileSaver.js/commit/485930a#commitcomment-8768047
		// for the reasoning behind the timeout and revocation flow
		, arbitrary_revoke_timeout = 500 // in ms
		, revoke = function(file) {
			var revoker = function() {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			if (view.chrome) {
				revoker();
			} else {
				setTimeout(revoker, arbitrary_revoke_timeout);
			}
		}
		, dispatch = function(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, auto_bom = function(blob) {
			// prepend BOM for UTF-8 XML and text/* types (including HTML)
			if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
				return new Blob(["\ufeff", blob], {type: blob.type});
			}
			return blob;
		}
		, FileSaver = function(blob, name) {
			blob = auto_bom(blob);
			// First try a.download, then web filesystem, then object URLs
			var
				  filesaver = this
				, type = blob.type
				, blob_changed = false
				, object_url
				, target_view
				, dispatch_all = function() {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function() {
					// don't create more object URLs than needed
					if (blob_changed || !object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (target_view) {
						target_view.location.href = object_url;
					} else {
						var new_tab = view.open(object_url, "_blank");
						if (new_tab == undefined && typeof safari !== "undefined") {
							//Apple do not allow window.open, see http://bit.ly/1kZffRI
							view.location.href = object_url
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				}
				, abortable = function(func) {
					return function() {
						if (filesaver.readyState !== filesaver.DONE) {
							return func.apply(this, arguments);
						}
					};
				}
				, create_if_not_found = {create: true, exclusive: false}
				, slice
			;
			filesaver.readyState = filesaver.INIT;
			if (!name) {
				name = "download";
			}
			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				save_link.href = object_url;
				save_link.download = name;
				click(save_link);
				filesaver.readyState = filesaver.DONE;
				dispatch_all();
				revoke(object_url);
				return;
			}
			// Object and web filesystem URLs have a problem saving in Google Chrome when
			// viewed in a tab, so I force save with application/octet-stream
			// http://code.google.com/p/chromium/issues/detail?id=91158
			// Update: Google errantly closed 91158, I submitted it again:
			// https://code.google.com/p/chromium/issues/detail?id=389642
			if (view.chrome && type && type !== force_saveable_type) {
				slice = blob.slice || blob.webkitSlice;
				blob = slice.call(blob, 0, blob.size, force_saveable_type);
				blob_changed = true;
			}
			// Since I can't be sure that the guessed media type will trigger a download
			// in WebKit, I append .download to the filename.
			// https://bugs.webkit.org/show_bug.cgi?id=65440
			if (webkit_req_fs && name !== "download") {
				name += ".download";
			}
			if (type === force_saveable_type || webkit_req_fs) {
				target_view = view;
			}
			if (!req_fs) {
				fs_error();
				return;
			}
			fs_min_size += blob.size;
			req_fs(view.TEMPORARY, fs_min_size, abortable(function(fs) {
				fs.root.getDirectory("saved", create_if_not_found, abortable(function(dir) {
					var save = function() {
						dir.getFile(name, create_if_not_found, abortable(function(file) {
							file.createWriter(abortable(function(writer) {
								writer.onwriteend = function(event) {
									target_view.location.href = file.toURL();
									filesaver.readyState = filesaver.DONE;
									dispatch(filesaver, "writeend", event);
									revoke(file);
								};
								writer.onerror = function() {
									var error = writer.error;
									if (error.code !== error.ABORT_ERR) {
										fs_error();
									}
								};
								"writestart progress write abort".split(" ").forEach(function(event) {
									writer["on" + event] = filesaver["on" + event];
								});
								writer.write(blob);
								filesaver.abort = function() {
									writer.abort();
									filesaver.readyState = filesaver.DONE;
								};
								filesaver.readyState = filesaver.WRITING;
							}), fs_error);
						}), fs_error);
					};
					dir.getFile(name, {create: false}, abortable(function(file) {
						// delete file if it already exists
						file.remove();
						save();
					}), abortable(function(ex) {
						if (ex.code === ex.NOT_FOUND_ERR) {
							save();
						} else {
							fs_error();
						}
					}));
				}), fs_error);
			}), fs_error);
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function(blob, name) {
			return new FileSaver(blob, name);
		}
	;
	// IE 10+ (native saveAs)
	if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
		return function(blob, name) {
			return navigator.msSaveOrOpenBlob(auto_bom(blob), name);
		};
	}

	FS_proto.abort = function() {
		var filesaver = this;
		filesaver.readyState = filesaver.DONE;
		dispatch(filesaver, "abort");
	};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error =
	FS_proto.onwritestart =
	FS_proto.onprogress =
	FS_proto.onwrite =
	FS_proto.onabort =
	FS_proto.onerror =
	FS_proto.onwriteend =
		null;

	return saveAs;
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports.saveAs = saveAs;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd != null)) {
  define([], function() {
    return saveAs;
  });
}

},{}],4:[function(require,module,exports){
(function() {
  if (typeof module === "undefined") self.queue = queue;
  else module.exports = queue;
  queue.version = "1.0.4";

  var slice = [].slice;

  function queue(parallelism) {
    var q,
        tasks = [],
        started = 0, // number of tasks that have been started (and perhaps finished)
        active = 0, // number of tasks currently being executed (started but not finished)
        remaining = 0, // number of tasks not yet finished
        popping, // inside a synchronous task callback?
        error = null,
        await = noop,
        all;

    if (!parallelism) parallelism = Infinity;

    function pop() {
      while (popping = started < tasks.length && active < parallelism) {
        var i = started++,
            t = tasks[i],
            a = slice.call(t, 1);
        a.push(callback(i));
        ++active;
        t[0].apply(null, a);
      }
    }

    function callback(i) {
      return function(e, r) {
        --active;
        if (error != null) return;
        if (e != null) {
          error = e; // ignore new tasks and squelch active callbacks
          started = remaining = NaN; // stop queued tasks from starting
          notify();
        } else {
          tasks[i] = r;
          if (--remaining) popping || pop();
          else notify();
        }
      };
    }

    function notify() {
      if (error != null) await(error);
      else if (all) await(error, tasks);
      else await.apply(null, [error].concat(tasks));
    }

    return q = {
      defer: function() {
        if (!error) {
          tasks.push(arguments);
          ++remaining;
          pop();
        }
        return q;
      },
      await: function(f) {
        await = f;
        all = false;
        if (!remaining) notify();
        return q;
      },
      awaitAll: function(f) {
        await = f;
        all = true;
        if (!remaining) notify();
        return q;
      }
    };
  }

  function noop() {}
})();

},{}]},{},[2]);
