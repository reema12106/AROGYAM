from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from backend.routes.auth import auth_bp
from backend.routes.main import main_bp
from backend.services.database import init_db
from backend.config import Config
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def create_app():
    app = Flask(__name__, static_folder='../frontend', static_url_path='')
    app.config.from_object(Config)

    # Enable CORS
    CORS(app)

    # Initialize database
    init_db(app)

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(main_bp, url_prefix='/api')

    # Root-level health endpoint for easier frontend checks
    @app.route('/health')
    def root_health():
        from datetime import datetime
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "message": "Root health endpoint"
        }

    # Serve frontend files
    @app.route('/')
    def serve_frontend():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory(app.static_folder, path)

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)