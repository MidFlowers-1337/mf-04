import sqlite3
from db import get_db


class ItemRepository:
    @staticmethod
    def create_item(data):
        db = get_db()
        cursor = db.execute(
            '''INSERT INTO items (title, item_type, creator, tags, rating, comment, status,
               start_date, end_date, total_episodes, current_episode, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (data['title'], data['item_type'], data.get('creator'),
             data.get('tags'), data.get('rating'), data.get('comment'),
             data.get('status', 'want'), data.get('start_date'),
             data.get('end_date'), data.get('total_episodes'),
             data.get('current_episode', 0), data.get('sort_order', 0))
        )
        db.commit()
        return cursor.lastrowid

    @staticmethod
    def get_item(item_id):
        db = get_db()
        row = db.execute('SELECT * FROM items WHERE id = ?', (item_id,)).fetchone()
        return dict(row) if row else None

    @staticmethod
    def list_items(item_type=None, status=None):
        db = get_db()
        query = 'SELECT * FROM items WHERE 1=1'
        params = []
        if item_type:
            query += ' AND item_type = ?'
            params.append(item_type)
        if status:
            query += ' AND status = ?'
            params.append(status)
        query += ' ORDER BY sort_order ASC, id DESC'
        rows = db.execute(query, params).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def update_item(item_id, data):
        db = get_db()
        fields = []
        params = []
        for key in ['title', 'creator', 'tags', 'rating', 'comment', 'status',
                    'start_date', 'end_date', 'total_episodes', 'current_episode',
                    'sort_order']:
            if key in data:
                fields.append(f'{key} = ?')
                params.append(data[key])
        if not fields:
            return False
        params.append(item_id)
        fields.append("updated_at = datetime('now', 'localtime')")
        db.execute(f'UPDATE items SET {", ".join(fields)} WHERE id = ?', params)
        db.commit()
        return True

    @staticmethod
    def delete_item(item_id):
        db = get_db()
        db.execute('DELETE FROM items WHERE id = ?', (item_id,))
        db.commit()
        return True

    @staticmethod
    def get_wantlist():
        db = get_db()
        rows = db.execute(
            "SELECT * FROM items WHERE status = 'want' ORDER BY sort_order ASC, id DESC"
        ).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def update_sort_order(item_id, sort_order):
        db = get_db()
        db.execute(
            "UPDATE items SET sort_order = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            (sort_order, item_id)
        )
        db.commit()

    @staticmethod
    def find_by_title_and_type(title, item_type):
        db = get_db()
        row = db.execute(
            'SELECT * FROM items WHERE title = ? AND item_type = ?',
            (title, item_type)
        ).fetchone()
        return dict(row) if row else None

    @staticmethod
    def get_all_items():
        db = get_db()
        rows = db.execute('SELECT * FROM items ORDER BY id').fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def get_items_by_year(year):
        db = get_db()
        rows = db.execute(
            "SELECT * FROM items WHERE strftime('%Y', created_at) = ? ORDER BY created_at",
            (str(year),)
        ).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def get_monthly_stats(year, item_type=None):
        db = get_db()
        query = """
            SELECT strftime('%m', created_at) as month, COUNT(*) as count
            FROM items
            WHERE strftime('%Y', created_at) = ?
        """
        params = [str(year)]
        if item_type:
            query += " AND item_type = ?"
            params.append(item_type)
        query += " GROUP BY month ORDER BY month"
        rows = db.execute(query, params).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def get_type_stats(year):
        db = get_db()
        rows = db.execute(
            """SELECT item_type, COUNT(*) as count, AVG(rating) as avg_rating
               FROM items
               WHERE strftime('%Y', created_at) = ?
               GROUP BY item_type""",
            (str(year),)
        ).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def get_avg_rating(year, item_type=None):
        db = get_db()
        query = "SELECT AVG(rating) as avg_rating FROM items WHERE strftime('%Y', created_at) = ? AND rating IS NOT NULL"
        params = [str(year)]
        if item_type:
            query += " AND item_type = ?"
            params.append(item_type)
        row = db.execute(query, params).fetchone()
        return row['avg_rating'] if row else None
