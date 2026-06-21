import os
import sqlite3
from flask import g, current_app


def get_db():
    if 'db' not in g:
        db_path = os.path.join(current_app.instance_path, 'tracker.db')
        g.db = sqlite3.connect(db_path)
        g.db.row_factory = sqlite3.Row
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db(app):
    os.makedirs(app.instance_path, exist_ok=True)
    with app.app_context():
        db = get_db()
        schema_path = os.path.join(app.root_path, 'schema.sql')
        with open(schema_path, 'r', encoding='utf-8') as f:
            db.executescript(f.read())
        db.commit()
