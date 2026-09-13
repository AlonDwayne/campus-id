from flask import Flask, send_from_directory

from .db import init_db
from .routes import register_routes


def create_app():
    app = Flask(__name__, static_folder="../frontend", static_url_path="")
    init_db()
    register_routes(app)

    @app.route("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    @app.route("/<path:filename>")
    def static_files(filename):
        return send_from_directory(app.static_folder, filename)

    return app