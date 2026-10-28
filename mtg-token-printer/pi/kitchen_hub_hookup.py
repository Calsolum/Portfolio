"""How the token routes plug into the Kitchen Hub label server.

This file is a template, not something to run. On the Pi, copy the
`token_printer/` folder next to label_server.py, then add the lines below to
label_server.py after the Flask `app` is created. The three adapter functions
are the only part that depends on label_server.py's own names, so fill them in
from the job queue it already has.
"""

from token_printer import create_blueprint


def submit_token(image, copies):
    """Queue `image` on the existing print loop; return the job id.

    Use the same function the /print/text route uses to start a job, passing
    the already-rendered image instead of text.
    """
    raise NotImplementedError


def token_job_status(job_id):
    """Return the label server's job record for `job_id`, or None if unknown."""
    raise NotImplementedError


def current_label_size():
    """Return the loaded preset's (width, height) in pixels."""
    raise NotImplementedError


# The label server already applies its own margin and print-head offset when
# it draws labels; pass the same values so tokens line up with everything else.
app.register_blueprint(create_blueprint(  # noqa: F821  (app lives in label_server.py)
    submit=submit_token,
    status=token_job_status,
    label_size=current_label_size,
    margin=20,
    x_shift=0,
))
