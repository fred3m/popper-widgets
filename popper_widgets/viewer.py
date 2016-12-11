from past.builtins import basestring
import os
from io import BytesIO
import time
import base64

import numpy as np

import ipywidgets as widgets
import traitlets
from IPython.display import display

from .utils import float_check, get_full_path

class DivLayer(traitlets.HasTraits):
    """
    Object to shadow the javascript DivLayer object to keep track of images and markers
    in the client
    """
    active = traitlets.Bool(True).tag(sync=True)
    def __init__(self, viewer, div_id, div_name=None, images=None, markers=None, active=True):
        self.viewer = viewer
        self.div_id = div_id
        self.div_name = div_name
        self.images = []
        self.markers = []
        
        if div_name is None:
            self.div_name = 'Layer {0}'.format(self.div_id)
        if images is not None:
            self.images = images
        if markers is not None:
            self.markers = markers
    
    def get_info(self):
        info = {
            'div_id': self.div_id,
            'div_name': self.div_name,
            'active': self.active
        }
        return info
    
    @traitlets.observe('active')
    def update_active(self, update):
        layer_packet = {
            'action': 'update',
            'div_id': self.div_id,
            'update': self.get_info()
        }
        self.viewer._layers[self.div_id] = self.get_info()
        self.viewer.send_msg('layer_packet', layer_packet)

@widgets.register('popper_widgets.InteractiveViewer')
class InteractiveViewer(widgets.DOMWidget):
    _model_name = traitlets.Unicode('InteractiveViewerModel').tag(sync=True)
    _model_module = traitlets.Unicode('popper-widgets').tag(sync=True)
    _view_name = traitlets.Unicode('InteractiveViewer').tag(sync=True)
    _view_module = traitlets.Unicode('popper-widgets').tag(sync=True)
    
    scale = traitlets.Float().tag(sync=True)
    width = traitlets.Int().tag(sync=True)
    height = traitlets.Int().tag(sync=True)
    coords = traitlets.List().tag(sync=True)
    viewer_properties = traitlets.Dict().tag(sync=True)
    
    markers = traitlets.Dict().tag(sync=True)
    _layers = traitlets.List().tag(sync=True)
    
    _msg = traitlets.Dict().tag(sync=True)
    
    def __init__(self, coord_widget=None, scale=1.0, width=-1, height=-1, layers=2,
                 viewer_properties=None, cmap=None, *args, **kwargs):
        self.msg_id = 0
        default_viewer_properties = {
            'css': {
                'border-style': 'solid',
                'border-width': 2,
                'overflow': 'scroll',
                'position': 'relative'
            },
            'mousemoveDelay': 100, # in ms
            'extraEventKeys': {}
        };
        default_cmap = {
            'cmap': 'inferno',
            'invert': False,
            'px_min': None,
            'px_max': None
        }
        
        self.scale = scale;
        self.width = width;
        self.height = height;
        if viewer_properties is not None:
            default_viewer_properties.update(viewer_properties)
        if cmap is not None:
            default_cmap.update(cmap)
        
        self.viewer_properties = default_viewer_properties
        self.colormap = default_cmap
        self.coord_widget = coord_widget
        
        # Create a counter to keep track of the next layer id
        self._next_layer = 0
        self.layers = []
        self._layers = []
        for l in range(layers):
            self.add_layer()
        
        widgets.DOMWidget.__init__(self, *args, **kwargs)
        
        # Allow the user to register call handlers for events
        self._click_handlers = widgets.CallbackDispatcher()
        # Action when receiving a message from the client
        self.on_msg(self._handle_client_msg)
    
    def add_layer(self, idx=None, div_name=None):
        div_id = self._next_layer
        self._next_layer += 1
        new_layer = DivLayer(self, div_id, div_name)
        if idx is None:
            self.layers.append(new_layer)
        else:
            self.layers.insert(idx, new_layer)
        self._layers = self.get_layer_info()
        layer_packet = {
            'action': 'add layer',
            'info': self.layers[-1].get_info()
        }
        
        self.send_msg('layer_packet', layer_packet)
    
    def get_layer_info(self):
        return [layer.get_info() for layer in self.layers]
    
    @traitlets.observe('coords')
    def update_coords(self, coords):
        if self.coord_widget is not None:
            x,y = [int(n) for n in coords['new']]
            self.coord_widget.update(x, y)
    
    @traitlets.observe('scale')
    def update_scale(self, scale):
        self.reload_viewer_items()
    
    def reload_viewer_items(self):
        """
        Reload all of the images in the client
        """
        if not hasattr(self, 'layers'):
            # Before the class is initialized, layers is not set and we can ignore this func
            return
        for layer in self.layers:
            for tile_packet in layer.images:
                self.add_image(tile_packet=tile_packet, update=True)
    
    def onclick(self, callback, remove=False):
        """Register a callback to execute when the button is clicked.
        The callback will be called with one argument, the clicked button
        widget instance.
        Parameters
        ----------
        remove: bool (optional)
            Set to true to remove the callback from the list of callbacks.
        """
        self._click_handlers.register_callback(callback, remove=remove)
    
    def _handle_client_msg(self, _, content, buffers):
        """Handle a msg from the front-end.
        Parameters
        ----------
        content: dict
            Content of the msg.
        """
        if 'event' in content and content['event']['type']=='click':
            self._click_handlers(self, content)
    
    def add_image(self, src=None, fmt=None, clear=True, x=0, y=0, layer=0, update=False, 
                  tile_packet=None, **kwargs):
        from copy import deepcopy
        if tile_packet is None:
            tile_packet = {
                'src': src,
                'clear': clear,
                'x': x,
                'y': y,
                'layer': layer,
                'format': fmt,
                'kwargs': kwargs
            }
        send_packet = self.load_image(deepcopy(tile_packet))
        save_packet = send_packet.copy()
        
        # Remove fields not needed in the client (tile_packet) and the server (save_packet)
        del send_packet['src']
        del send_packet['kwargs']
        del save_packet['data']
        
        # Send the tile packet to the browser
        self.send_msg('tile_packet', send_packet)
        
        # Save the information needed to reload/recreate the image tile if a change
        # is made to the viewer (scale, width, height, etc.), if this is not an update
        # (which occurs when the scale, width, or height of the viewer is changed)
        if not update:
            if save_packet['clear']:
                self.layers[save_packet['layer']].images = [save_packet]
            else:
                self.layers[save_packet['layer']].images.append(save_packet)
    
    def load_image(self, tile_packet):
        # If src is a filename, load the file and return its bytecode
        # Otherwise, create the tile from an array
        if isinstance(tile_packet['src'], basestring):
            with open(tile_packet['src'], "rb") as f:
                img = f.read()
            data = img
            if tile_packet['format'] is None:
                tile_packet['format'] = tile_packet['src'].split('.')[-1]
        else:
            data = self.create_tile(tile_packet['src'], **tile_packet['kwargs'])
            tile_packet['format'] = 'png'
        
        tile_packet['data'] = base64.b64encode(data)
        return tile_packet
    
    def create_tile(self, data, **kwargs):
        from PIL import Image as pilImage
        from matplotlib import cm as cmap
        from matplotlib.colors import Normalize, LinearSegmentedColormap
        from copy import deepcopy
        
        # TODO: remove this line
        scale = self.scale
        
        colormap = deepcopy(self.colormap)
        
        # Set any non-default colormap parameters
        for kwarg, value in kwargs.items():
            if kwarg in self.colormap:
                colormap[kwarg] = value
        full_cmap = colormap['cmap']
        if colormap['invert']:
            full_cmap += "_r"
        mpl_colormap = getattr(cmap, full_cmap)
        # Create the full colormap
        if colormap['px_min'] is not None and colormap['px_max'] is not None:
            norm = Normalize(colormap['px_min'], colormap['px_max'], True)
            cmappable = cmap.ScalarMappable(norm, mpl_colormap)
        else:
            cmappable = cmap.ScalarMappable(None, mpl_colormap)
        # Map the image data to an array with RGBA values
        img = np.uint8(cmappable.to_rgba(data)*255)
        
        # If an alpha value is specified, apply it to the alpha channel for evey pixel
        if 'alpha' in kwargs:
            img[:,:,3] = 255*kwargs['alpha']
        
        # If the data is a masked array, set the alpha channel to zero for all of the
        # masked pixels (which makes them transparent)
        if hasattr(data, 'mask'):
            if 'alpha' in kwargs:
                alpha = kwargs['alpha']
            else:
                alpha = 1
            img[:,:,3] = ~data.mask*255*alpha
        img = pilImage.fromarray(img)
        
        # Scale the array (if necessary)
        if not float_check(scale, 1.0):
            height, width = data.shape
            img = img.resize((int(width*scale),int(height*scale)), pilImage.NEAREST)
        img_data = BytesIO()
        img.save(img_data, format='png')
        return img_data.getvalue()
    
    def add_markers(self, x=None, y=None, size=10, marker='x', css=None, clear=True, layer=1):
        default_css = {
            'stroke': '#FF0000',
            'stroke-width': 2
        }
        if css is not None:
            default_css.update(css)
        
        markers = {
            'css': default_css,
            'size': size,
            'marker': marker,
            'clear': clear,
            'layer': layer
        }
        
        if x is not None and y is not None:
            if hasattr(x, '__len__'):
                if len(x)!=len(y):
                    raise Exception("x and y must have the same number of entries")
                xlist = x
                ylist = y
            else:
                xlist = [x]
                ylist = [y]
            markers['x'] = xlist
            markers['y'] = ylist
        
        self.markers = markers
        
        if clear:
            self.layers[layer].makers = [markers]
        else:
            self.layers[layer].markers.append(markers)
    
    def send_msg(self, msg_type, msg):
        self._msg = {
            'type': msg_type,
            'msg': msg,
            'msg_id': self.msg_id
        }
        #print('sending message', self._msg)
        self.msg_id += 1