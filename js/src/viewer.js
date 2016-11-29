// Required Code for Jupyter Widgets
var widgets = require('jupyter-js-widgets');
var _ = require('underscore');

// Class for a layer in the viewer
var DivLayer = function(options){
    this.$element = $('<div/>');
    this.$element.css({
        padding: 0,
        margin: 0
    })
    this.div_id = options.div_id;
    this.div_name = options.div_name;
    this.active = options.active;
    this.images = [];
    this.markers = [];
    this.border = parseInt(options.$parent.css('border-width'));
};

// Draw a line from (x1,y1) to (x2,y2)
var drawLine = function(x1, y1, x2, y2){
    var line = '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'"/>';
    return line;
};

// Combine default marker parameters with user specified options
var getMarkerParams= function(options){
    // Set defaults
    var params = {
        size: 10,
        css: {
            'stroke': '#FF0000',
            'stroke-width': 2
        }
    };
    
    params = $.extend(true, params, options);
    params.half = params.size/2;
    return params;
};

// Draw a marker using an SVG tag
var drawSvg = function(options){
    // The lines must be included in the svg element when it is first drawn,
    // so we have to create the svg tag by concatenating the pieces together and
    // then add it to the DOM
    var svg = '<svg height='+options.height+' width='+options.width+'>';
    
    for(var i=0; i<options.$lines.length; i++){
        svg = svg + options.$lines[i][0].outerHTML;
    };
    
    svg = svg + '</svg>';
    var $svg = $(svg);
    
    // We can still change the position of the svg, even after it has been drawn
    $svg.css({
        'position': 'absolute',
        'left': options.x+'px',
        'top': options.y+'px'
    });
    return $svg;
};

// Draw a Plus sign on the parent div
var drawPlus = function(params){
    // Draw the lines
    var l1 = drawLine(params.half, 0, params.half, params.size);
    var l2 = drawLine(0, params.half, params.size, params.half);
    var $line1 = $(l1);
    var $line2 = $(l2);
    $line1.css(params.css);
    $line2.css(params.css);
    
    var $svg = drawSvg({
        width: params.size,
        height: params.size,
        x: params.x-params.half,
        y: params.y-params.half,
        $lines: [$line1, $line2]
    });
    
    return $svg
};

// Draw a Plus sign on the parent div
var drawX = function(params){
    // Draw the lines
    var l1 = drawLine(0, 0, params.size, params.size);
    var l2 = drawLine(0, params.size, params.size, 0);
    var $line1 = $(l1);
    var $line2 = $(l2);
    $line1.css(params.css);
    $line2.css(params.css);
    
    var $svg = drawSvg({
        width: params.size,
        height: params.size,
        x: params.x-params.half,
        y: params.y-params.half,
        $lines: [$line1, $line2]
    });
    
    return $svg
};

// Draw a circle on the parent div
var drawCircle = function(params){
    if(!params.css.hasOwnProperty('fill')){
        params.css.fill = 'none';
    };
    
    var cx = params.half+params.css['stroke-width'];
    var cy = params.half+params.css['stroke-width'];
    var r = params.half;
    var c = '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'"/>';
    var $c = $(c);
    $c.css(params.css);
    var $svg = drawSvg({
        width: params.size+2*params.css['stroke-width'],
        height: params.size+2*params.css['stroke-width'],
        x: params.x-params.half-params.css['stroke-width'],
        y: params.y-params.half-params.css['stroke-width'],
        $lines: [$c]
    })
    return $svg;
};

// Draw a Marker. If ``marker`` is string ("x", "plus", or "circle") then the specified marker
// will be drawn. Otherwise ``marker`` should be a function used to draw the marker on an SVG element
var drawMarker = function(marker, layer, options){
    var func;
    var $div = layer.$element;
    var params = getMarkerParams(options);
    if(marker=='plus'){
        func = drawPlus;
    }else if(marker=='x'){
        func = drawX;
    }else if(marker=='circle'){
        func = drawCircle;
    }else{
        func = marker;
    };
    var $svg = func(params);
    $div.append($svg);
};

var InteractiveViewerModel = widgets.DOMWidgetModel.extend({
    defaults: _.extend({}, widgets.DOMWidgetModel.prototype.defaults, {
        _model_name: 'InteractiveViewerModel',
        _model_module : 'popper-widgets',
        _view_name: 'InteractiveViewer',
        _view_module: 'popper-widgets',
        scale: 1.0,
        width: -1,
        height: -1,
        coords: [0,0],
        viewer_properties: {},
        markers: {},
        _layers: [],
        _msg: {}
    })
});

var InteractiveViewer = widgets.DOMWidgetView.extend({
    render: function(){
        // Run this function when the object is rendered to the display
        
        var width = this.model.get('width');
        var height = this.model.get('height');
        var properties = this.model.get('viewer_properties');
        
        // If the user does not specify a size for the viewer, use 90% the width of the
        // jupyter notebook area
        if(width<0){
            width = $('#notebook-container').width()*.9;
            this.model.set('width', width);
        };
        if(height<0){
            height = Math.round(width*9/16);
            this.model.set('height', height);
        };
        console.log('Viewer size: ', width, height);
        
        // Create a main div that will contain all of the layers with images and markers
        this.$viewer_div = $('<div/>')
            .css({
                padding: 0,
                margin: 0
            });
        this.$viewer_div.width(width);
        this.$viewer_div.height(height);
        
        // Add any custom .css properties
        if(properties.hasOwnProperty("css")){
            for (var key in properties.css) {
                if (properties.css.hasOwnProperty(key)) {
                    this.$viewer_div.css(key, properties.css[key]);
                };
            };
        };
        this.$el.append(this.$viewer_div);
        
        // Add a layer for the images and one for markers to the main div
        var layers = this.model.get('_layers');
        this.layers = [];
        for(var n=0; n<layers.length; n++){
            var new_layer = new DivLayer($.extend(layers, {
                $parent: this.$viewer_div,
            }));
            this.layers.push(new_layer);
            this.$viewer_div.append(new_layer.$element);
        };
        
        // Some events, like mousemoves, will only update every t milliseconds
        // These timers are stored in this.timers to be reset and removed as needed
        this.timers = {};
    },
    // An update has been received from the server
    update: function(myUpdate){
        //console.log('update', myUpdate.changed);
        if(myUpdate.changed.hasOwnProperty('_msg')){
            // Received a message from the server
            var msg = myUpdate.changed._msg;
            if(msg.type=='tile_packet'){
                this.updateImage(msg.msg);
            }else if(msg.type=='layer_packet'){
                this.rxLayerPacket(msg.msg);
            };
        };
        if(myUpdate.changed.hasOwnProperty('scale')){
            this.resetLayers(true);
        };
        if(myUpdate.changed.hasOwnProperty('viewer_properties')){
            // Action to perform when viewer properties have been changed
            console.log('update viewer_properties here');
        };
        if(myUpdate.changed.hasOwnProperty('markers')){
            // Received a set of markers to add to a layer
            this.updateMarkers(myUpdate.changed.markers);
        };
    },
    // Action when layer information is received from the server
    rxLayerPacket: function(layer_packet){
        if(layer_packet.update=='new layer'){
            var new_layer = new DivLayer($.extend(layer_packet.layers, {
                $parent: this.$viewer_div,
            }));
            this.layers.push(new_layer);
            this.$viewer_div.append(new_layer.$element);
        };
    },
    // Clear all of the layers of images and (optionally) redraw the markers
    resetLayers: function(drawMarkers){
        drawMarkers = drawMarkers || false;
        for(var l=0; l<this.layers.length; l++){
            var layer = this.layers[l];
            layer.$element.empty();
        };
        if(drawMarkers){
            for(var l=0; l<this.layers.length; l++){
                this.drawMarkers(this.layers[l]);
            };
        };
    },
    // Update the image in the display
    updateImage: function(tile_packet){
        var img = new Image();
        var scale = this.model.get("scale");
        var $layer = this.layers[tile_packet.layer].$element;
        
        img.src = 'data:image/'+tile_packet.format+';base64,'+tile_packet.data;
        this.$image = $(img);
        this.$image.css('position', 'absolute');
        this.$image.css('left', tile_packet.x*scale+'px');
        this.$image.css('top', tile_packet.y*scale+'px');
        
        // Clear out all of the images currently in the layer, if necessary
        if(tile_packet.clear){
            $layer.empty();
        };
        // Add the new images to the specified layer
        $layer.append(img);
    },
    // Update the markers positions and/or marker attributes
    updateMarkers: function(markers){
        var layer = markers.layer;
        delete markers.layer;
        if(markers.clear){
            this.layers[layer].markers = [markers];
            this.layers[layer].$element.empty();
        }else{
            this.layers[layer].markers.push(markers);
        };
        
        this.drawMarkers(this.layers[layer]);
    },
    // Draw all of the markers on the specified layer
    drawMarkers: function(layer){
        var scale = this.model.get('scale');
        for(var m=0; m<layer.markers.length; m++){
            var markers = layer.markers[m];
            for(var n=0; n<markers.x.length; n++){
                var marker;
                var params = {
                    x: markers.x[n]*scale,
                    y: markers.y[n]*scale
                };
                if(Array.isArray(markers.css)){
                    params.css = markers.css[n]
                }else{
                    params.css = markers.css
                };
                if(Array.isArray(markers.size)){
                    params.size = markers.size[n];
                }else{
                    params.size = markers.size;
                };
                if(Array.isArray(markers.marker)){
                    marker = markers.marker[n];
                }else{
                    marker = markers.marker;
                };
                drawMarker(marker, layer, params);
            };
        }
    },
    
    // Events to listen for (jQuery names of events)
    events: {
        "mousemove": "handle_mousemove",
        "click": "handle_click"
    },
    // A javascript event contains information, like DOM Elements, that cannot be passed to the
    // server. This method extracts relavant fields from a javascript event to forward to the server
    getEventInfo(event){
        var offset = this.$viewer_div.offset();
        var properties = this.model.get('viewer_properties');
        var coords = this.get_coords(event);
        var extraKeys = this.model.get('extraEventKeys');
        
        var eventInfo = {
            clientX: event.clientX,
            clientY: event.clientY,
            offsetLeft: offset.left,
            offsetTop: offset.top,
            scrollTop: this.$viewer_div[0].scrollTop,
            scrollLeft: this.$viewer_div[0].scrollLeft,
            type: event.type,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            viewerX: coords[0],
            viewerY: coords[1]
        };
        
        // If the user wants any fields from the event not used by default, they
        // can be specified here
        for(var key in extraKeys){
            eventInfo[key] = event[key];
        };
        
        return eventInfo;
    },
    // Update the server with a mouse click event
    handle_click: function(event){
        var coords = this.get_coords(event);
        var mouse_event = this.getEventInfo(event);
        this.send({event: mouse_event});
    },
    // Callback for when the mouse is moved
    handle_mousemove: function(event) {
        var coords = this.get_coords(event);
        var properties = this.model.get("viewer_properties");
        // Only update the coords on the server every <t> ms, otherwise we flood the
        // server with too many updates
        if(!this.timers.hasOwnProperty("set_coords")){
            this.timers.set_coords = setTimeout(this.set_coords.bind(this, coords),
                                                properties.mousemoveDelay);
        };
    },
    // Calculate the cursor position on the image, factoring in borders, scrolling, and
    // scaling, so that the coordinates returned are the locations of the pixels on the
    // unscaled image. This could be done on the server, but these coordinates will also be
    // needed by other widgets in the browser so we calculate them here
    get_coords: function(event){
        var scrollTop = this.$viewer_div[0].scrollTop;
        var scrollLeft = this.$viewer_div[0].scrollLeft;
        var offset = this.$viewer_div.offset();
        var scale = this.model.get('scale');
        var border = parseInt(this.$viewer_div.css('border-width'));
        var x = (event.clientX-offset.left+scrollLeft)/scale-border;
        var y = (event.clientY-offset.top+scrollTop)/scale-border;
        return [x,y];
    },
    // Set the value of the canvas object
    set_coords: function(coords){
        this.model.set('coords', coords);
        this.touch();
        // Clear and delete the timer
        clearTimeout(this.timers.set_coords);
        delete this.timers.set_coords;
    }
});

module.exports = {
    InteractiveViewerModel: InteractiveViewerModel,
    InteractiveViewer: InteractiveViewer
};