import os
from flask import Flask, render_template

from db import close_db, init_db


def create_app():
    app = Flask(__name__, instance_relative_config=True)
    app.config['SECRET_KEY'] = 'dev-secret-key'
    
    app.teardown_appcontext(close_db)
    
    from routes import items_bp, stats_bp, import_export_bp
    app.register_blueprint(items_bp)
    app.register_blueprint(stats_bp)
    app.register_blueprint(import_export_bp)
    
    @app.route('/')
    def index():
        return render_template('index.html')
    
    @app.route('/stats')
    def stats_page():
        return render_template('stats.html')
    
    @app.route('/wantlist')
    def wantlist_page():
        return render_template('wantlist.html')
    
    return app


app = create_app()
init_db(app)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
