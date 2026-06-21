import sqlite3
from db import get_db


ITEM_RATING_FIELDS = {
    'book': ['rating_writing', 'rating_plot', 'rating_idea'],
    'movie': ['rating_story', 'rating_acting', 'rating_visual', 'rating_music'],
    'music': ['rating_melody', 'rating_lyrics', 'rating_production'],
}

ITEM_RATING_LABELS = {
    'book': ['文笔', '情节', '思想'],
    'movie': ['剧情', '表演', '画面', '配乐'],
    'music': ['旋律', '歌词', '制作'],
}

BASE_RATING_KEYS = ['rating', 'rating_writing', 'rating_plot', 'rating_idea',
                    'rating_story', 'rating_acting', 'rating_visual', 'rating_music',
                    'rating_melody', 'rating_lyrics', 'rating_production']

BASIC_WRITE_KEYS = ['title', 'creator', 'tags', 'comment', 'status',
                    'start_date', 'end_date', 'total_episodes', 'current_episode',
                    'sort_order'] + BASE_RATING_KEYS


def _attach_tags(items):
    if not items:
        return items
    ids = [i['id'] for i in items]
    placeholders = ','.join('?' for _ in ids)
    db = get_db()
    rows = db.execute(
        f"SELECT it.item_id, t.id as tag_id, t.name as tag_name "
        f"FROM item_tags it JOIN tags t ON it.tag_id = t.id "
        f"WHERE it.item_id IN ({placeholders}) ORDER BY it.id",
        ids
    ).fetchall()
    tag_map = {}
    for r in rows:
        tag_map.setdefault(r['item_id'], []).append({
            'id': r['tag_id'], 'name': r['tag_name']
        })
    for i in items:
        i['tag_list'] = tag_map.get(i['id'], [])
    return items


def _sync_item_tags(item_id, tag_names):
    db = get_db()
    names = [t.strip() for t in (tag_names or []) if t and t.strip()]
    db.execute("DELETE FROM item_tags WHERE item_id = ?", (item_id,))
    seen = set()
    for name in names:
        if name in seen:
            continue
        seen.add(name)
        db.execute("INSERT OR IGNORE INTO tags(name) VALUES (?)", (name,))
        t = db.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()
        if t:
            db.execute(
                "INSERT OR IGNORE INTO item_tags(item_id, tag_id) VALUES (?, ?)",
                (item_id, t['id'])
            )


def _calc_avg_rating(item_type, data):
    fields = ITEM_RATING_FIELDS.get(item_type, [])
    vals = [data.get(f) for f in fields if data.get(f) is not None]
    if not vals:
        return data.get('rating')
    return round(sum(vals) / len(vals))


class TagRepository:
    @staticmethod
    def list_tags():
        db = get_db()
        rows = db.execute(
            "SELECT t.*, COUNT(it.item_id) as usage_count "
            "FROM tags t LEFT JOIN item_tags it ON it.tag_id = t.id "
            "GROUP BY t.id ORDER BY usage_count DESC, t.name ASC"
        ).fetchall()
        return [dict(r) for r in rows]

    @staticmethod
    def get_or_create(name):
        db = get_db()
        db.execute("INSERT OR IGNORE INTO tags(name) VALUES (?)", (name,))
        row = db.execute("SELECT * FROM tags WHERE name = ?", (name,)).fetchone()
        db.commit()
        return dict(row) if row else None

    @staticmethod
    def rename_tag(tag_id, new_name):
        db = get_db()
        existing = db.execute("SELECT id FROM tags WHERE name = ? AND id != ?",
                              (new_name, tag_id)).fetchone()
        if existing:
            db.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
            tag_id = existing['id']
        else:
            db.execute("UPDATE tags SET name = ? WHERE id = ?", (new_name, tag_id))
        db.commit()
        return tag_id

    @staticmethod
    def delete_tag(tag_id):
        db = get_db()
        db.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
        db.commit()
        return True

    @staticmethod
    def get_tag_top10(year=None):
        db = get_db()
        query = (
            "SELECT t.id, t.name, COUNT(DISTINCT it.item_id) as count "
            "FROM tags t JOIN item_tags it ON it.tag_id = t.id "
            "JOIN items i ON i.id = it.item_id "
            "WHERE 1=1 "
        )
        params = []
        if year:
            query += " AND strftime('%Y', i.created_at) = ? "
            params.append(str(year))
        query += " GROUP BY t.id ORDER BY count DESC, t.name ASC LIMIT 10"
        rows = db.execute(query, params).fetchall()
        return [dict(r) for r in rows]


class ItemRepository:
    @staticmethod
    def create_item(data, keep_timestamp=False):
        db = get_db()
        rating_fields = ITEM_RATING_FIELDS.get(data['item_type'], [])
        avg = _calc_avg_rating(data['item_type'], data)
        if avg is not None:
            data['rating'] = avg

        insert_keys = [k for k in BASIC_WRITE_KEYS if k in data]
        cols = ', '.join(insert_keys)
        qs = ', '.join('?' for _ in insert_keys)
        vals = [data[k] for k in insert_keys]

        if keep_timestamp and 'created_at' in data:
            cols += ', created_at, updated_at'
            qs += ', ?, ?'
            vals.extend([data['created_at'], data.get('updated_at', data['created_at'])])

        cursor = db.execute(
            f"INSERT INTO items ({cols}) VALUES ({qs})", vals
        )
        item_id = cursor.lastrowid

        tag_names = data.get('tag_names')
        if tag_names is None and data.get('tags'):
            raw = data['tags']
            tag_names = [t.strip() for t in raw.replace('，', ',').split(',') if t.strip()]
        if tag_names is not None:
            _sync_item_tags(item_id, tag_names)
            raw_csv = ','.join(tag_names)
            db.execute("UPDATE items SET tags = ? WHERE id = ?", (raw_csv, item_id))

        db.commit()
        return item_id

    @staticmethod
    def get_item(item_id):
        db = get_db()
        row = db.execute('SELECT * FROM items WHERE id = ?', (item_id,)).fetchone()
        if not row:
            return None
        items = _attach_tags([dict(row)])
        return items[0]

    @staticmethod
    def list_items(item_type=None, status=None):
        db = get_db()
        query = 'SELECT * FROM items WHERE 1=1'
        params = []
        if item_type:
            if isinstance(item_type, list):
                ph = ','.join('?' for _ in item_type)
                query += f' AND item_type IN ({ph})'
                params.extend(item_type)
            else:
                query += ' AND item_type = ?'
                params.append(item_type)
        if status:
            if isinstance(status, list):
                ph = ','.join('?' for _ in status)
                query += f' AND status IN ({ph})'
                params.extend(status)
            else:
                query += ' AND status = ?'
                params.append(status)
        query += ' ORDER BY sort_order ASC, id DESC'
        rows = db.execute(query, params).fetchall()
        return _attach_tags([dict(r) for r in rows])

    @staticmethod
    def list_items_filtered(filters):
        db = get_db()
        query = 'SELECT DISTINCT i.* FROM items i'
        joins = []
        conds = []
        params = []

        tag_ids = filters.get('tag_ids') or []
        tag_mode = filters.get('tag_mode', 'or')
        if tag_ids:
            if tag_mode == 'and':
                for idx, tid in enumerate(tag_ids):
                    alias = f'it{idx}'
                    joins.append(f'JOIN item_tags {alias} ON {alias}.item_id = i.id AND {alias}.tag_id = ?')
                    params.append(tid)
            else:
                ph = ','.join('?' for _ in tag_ids)
                joins.append(f'JOIN item_tags it0 ON it0.item_id = i.id AND it0.tag_id IN ({ph})')
                params.extend(tag_ids)

        if joins:
            query += ' ' + ' '.join(joins)
        query += ' WHERE 1=1'

        item_types = filters.get('item_types') or []
        if item_types:
            ph = ','.join('?' for _ in item_types)
            conds.append(f'item_type IN ({ph})')
            params.extend(item_types)

        statuses = filters.get('statuses') or []
        if statuses:
            ph = ','.join('?' for _ in statuses)
            conds.append(f'status IN ({ph})')
            params.extend(statuses)

        min_rating = filters.get('min_rating')
        if min_rating is not None:
            conds.append('rating >= ?')
            params.append(min_rating)

        dim_field = filters.get('rating_dim')
        dim_min = filters.get('rating_dim_min')
        if dim_field and dim_min is not None:
            conds.append(f'{dim_field} >= ?')
            params.append(dim_min)

        date_from = filters.get('date_from')
        if date_from:
            conds.append("created_at >= ?")
            params.append(date_from)
        date_to = filters.get('date_to')
        if date_to:
            conds.append("created_at <= ?")
            params.append(date_to + ' 23:59:59')

        year = filters.get('year')
        if year:
            conds.append("strftime('%Y', created_at) = ?")
            params.append(str(year))

        if conds:
            query += ' AND ' + ' AND '.join(conds)

        query += ' ORDER BY i.sort_order ASC, i.id DESC'
        rows = db.execute(query, params).fetchall()
        return _attach_tags([dict(r) for r in rows])

    @staticmethod
    def update_item(item_id, data):
        db = get_db()
        fields = []
        params = []
        for key in BASIC_WRITE_KEYS:
            if key in data:
                fields.append(f'{key} = ?')
                params.append(data[key])

        row = db.execute('SELECT * FROM items WHERE id = ?', (item_id,)).fetchone()
        if not row:
            return False
        item_type = row['item_type']
        avg = _calc_avg_rating(item_type, data)
        if avg is not None and 'rating' not in data:
            fields.append('rating = ?')
            params.append(avg)

        tag_names = None
        if 'tag_names' in data:
            tag_names = data['tag_names']
        elif 'tags' in data:
            raw = data['tags'] or ''
            tag_names = [t.strip() for t in raw.replace('，', ',').split(',') if t.strip()]
        if tag_names is not None:
            raw_csv = ','.join(tag_names)
            if 'tags' not in data:
                fields.append('tags = ?')
                params.append(raw_csv)
            _sync_item_tags(item_id, tag_names)

        if fields:
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
        return _attach_tags([dict(r) for r in rows])

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
        if not row:
            return None
        items = _attach_tags([dict(row)])
        return items[0]

    @staticmethod
    def get_all_items():
        db = get_db()
        rows = db.execute('SELECT * FROM items ORDER BY id').fetchall()
        return _attach_tags([dict(r) for r in rows])

    @staticmethod
    def get_items_by_year(year):
        db = get_db()
        rows = db.execute(
            "SELECT * FROM items WHERE strftime('%Y', created_at) = ? ORDER BY created_at",
            (str(year),)
        ).fetchall()
        return _attach_tags([dict(r) for r in rows])

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

    @staticmethod
    def get_dimension_avgs(year=None, item_type=None):
        db = get_db()
        queries = {
            'book': (['rating_writing', 'rating_plot', 'rating_idea'], ['文笔', '情节', '思想']),
            'movie': (['rating_story', 'rating_acting', 'rating_visual', 'rating_music'], ['剧情', '表演', '画面', '配乐']),
            'music': (['rating_melody', 'rating_lyrics', 'rating_production'], ['旋律', '歌词', '制作']),
        }
        result = {}
        for itype, (fields, labels) in queries.items():
            if item_type and item_type != itype:
                continue
            result[itype] = []
            for f, l in zip(fields, labels):
                q = f"SELECT AVG({f}) as v FROM items WHERE item_type = ? AND {f} IS NOT NULL"
                p = [itype]
                if year:
                    q += " AND strftime('%Y', created_at) = ?"
                    p.append(str(year))
                row = db.execute(q, p).fetchone()
                val = row['v'] if row else None
                result[itype].append({
                    'dim': f,
                    'label': l,
                    'avg': round(float(val), 2) if val is not None else None
                })
        return result
