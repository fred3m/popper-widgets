popper-widgets
===============================

Widgets For Popper

Installation
------------

To install use pip (not yet supported, use development installation for now):

    $ pip install popper_widgets
    $ jupyter nbextension enable --py --sys-prefix popper_widgets


For a development installation (requires npm),

    $ git clone https://github.com/fred3m/popper-widgets.git
    $ cd popper-widgets
    $ pip install -e .
    $ jupyter nbextension install --py --symlink --sys-prefix popper_widgets
    $ jupyter nbextension enable --py --sys-prefix popper_widgets
