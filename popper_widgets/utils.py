def float_check(x, y, err=1e-5):
    if x+err>y and x-err<y:
        return True
    return False

def get_full_path(path):
    return os.path.abspath(os.path.expanduser(os.path.expandvars(path)))