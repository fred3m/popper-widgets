# It is frequently common to display a label with some special format
# This module contains the specialized labels used in popper

import ipywidgets as widgets
import traitlets

class CoordWidget(widgets.Label):
    def __init__(self, x=0, y=0, *args, **kwargs):
        self.x = x
        self.y = y
        widgets.Label.__init__(self, *args, **kwargs)
        self.update()
    
    def update(self, x=None, y=None):
        if x is not None:
            self.x = x
        if y is not None:
            self.y = y
        self.value = "x={0}, y={1}".format(self.x, self.y)