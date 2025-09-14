from flask import Flask
from .routes.main import main_bp
from .services import database
from .config import Config

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize DB
    database.init_db(app)

    # Register blueprints
    app.register_blueprint(main_bp)

    @app.route("/ping")
    def ping():
        return {"status": "ok", "message": "Arogyam backend running!"}

    @app.route("/db-check")
    def db_check():
        return {"db_time": database.test_query()}

    return app


# 🔹 This block makes sure Flask runs when using python -m backend.app
if __name__ == "__main__" or __name__ == "backend.app":
    app = create_app()
    app.run(debug=True)
