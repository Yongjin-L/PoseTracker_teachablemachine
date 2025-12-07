"""
Pose Duration Tracker with Teachable Machine
A Flask web application for tracking pose durations using AI

Features:
- Load Teachable Machine pose models via URL
- Real-time pose detection with webcam
- Accurate duration tracking
- Session history with local storage
- CSV export functionality

Author: Yongjin Lee
License: MIT
"""

import os
from flask import Flask, render_template

# Initialize Flask app
app = Flask(__name__)

# Security: Use environment variable for secret key, fallback to random bytes
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or os.urandom(24)

# Configuration
app.config['DEBUG'] = os.environ.get('FLASK_ENV') == 'development'


@app.route("/")
def index():
    """Render the main application page."""
    return render_template("index.html")


@app.route("/health")
def health():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "message": "Pose Duration Tracker is running"}


# Error handlers
@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return render_template("index.html"), 404


@app.errorhandler(500)
def server_error(error):
    """Handle 500 errors."""
    return {"error": "Internal server error"}, 500


if __name__ == "__main__":
    # Get port from environment variable (for deployment platforms like Render, Heroku)
    port = int(os.environ.get("PORT", 5000))

    # Only enable debug mode in development
    debug_mode = os.environ.get('FLASK_ENV') == 'development'

    app.run(host="0.0.0.0", port=port, debug=debug_mode)
