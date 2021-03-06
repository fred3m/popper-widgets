from ._version import version_info, __version__

from .viewer import *
from .labels import *
from . import utils

def _jupyter_nbextension_paths():
    return [{
        'section': 'notebook',
        'src': 'static',
        'dest': 'popper-widgets',
        'require': 'popper-widgets/extension'
    }]
