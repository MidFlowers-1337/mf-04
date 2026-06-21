from datetime import datetime
from models.repository import ItemRepository


class ItemService:
    @staticmethod
    def create_item(data):
        if 'title' not in data or 'item_type' not in data:
            raise ValueError('title and item_type are required')
        if data['item_type'] not in ['book', 'movie', 'music']:
            raise ValueError('item_type must be book, movie, or music')
        if 'rating' in data and data['rating'] is not None:
            if not (1 <= data['rating'] <= 5):
                raise ValueError('rating must be between 1 and 5')
        if 'status' in data:
            if data['status'] not in ['want', 'doing', 'done']:
                raise ValueError('status must be want, doing, or done')
        item_id = ItemRepository.create_item(data)
        return ItemRepository.get_item(item_id)

    @staticmethod
    def get_item(item_id):
        return ItemRepository.get_item(item_id)

    @staticmethod
    def list_items(item_type=None, status=None):
        return ItemRepository.list_items(item_type, status)

    @staticmethod
    def update_item(item_id, data):
        item = ItemRepository.get_item(item_id)
        if not item:
            return None
        if 'rating' in data and data['rating'] is not None:
            if not (1 <= data['rating'] <= 5):
                raise ValueError('rating must be between 1 and 5')
        if 'status' in data:
            if data['status'] not in ['want', 'doing', 'done']:
                raise ValueError('status must be want, doing, or done')
        ItemRepository.update_item(item_id, data)
        return ItemRepository.get_item(item_id)

    @staticmethod
    def delete_item(item_id):
        item = ItemRepository.get_item(item_id)
        if not item:
            return False
        return ItemRepository.delete_item(item_id)

    @staticmethod
    def update_episode(item_id, current_episode):
        item = ItemRepository.get_item(item_id)
        if not item:
            return None
        if item['item_type'] != 'movie':
            raise ValueError('only movie items have episodes')
        
        total = item.get('total_episodes') or 0
        new_status = item['status']
        end_date = item.get('end_date')
        
        if total > 0 and current_episode >= total:
            new_status = 'done'
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
        elif current_episode > 0 and item['status'] == 'want':
            new_status = 'doing'
            if not item.get('start_date'):
                ItemRepository.update_item(item_id, {
                    'start_date': datetime.now().strftime('%Y-%m-%d')
                })
        
        update_data = {'current_episode': current_episode}
        if new_status != item['status']:
            update_data['status'] = new_status
        if end_date and end_date != item.get('end_date'):
            update_data['end_date'] = end_date
        
        ItemRepository.update_item(item_id, update_data)
        return ItemRepository.get_item(item_id)

    @staticmethod
    def get_wantlist():
        return ItemRepository.get_wantlist()

    @staticmethod
    def reorder_wantlist(item_order):
        for idx, item_id in enumerate(item_order):
            ItemRepository.update_sort_order(item_id, idx)
        return True

    @staticmethod
    def pin_item(item_id):
        wantlist = ItemRepository.get_wantlist()
        if not wantlist:
            return False
        target = None
        for item in wantlist:
            if item['id'] == item_id:
                target = item
                break
        if not target:
            return False
        wantlist.remove(target)
        wantlist.insert(0, target)
        for idx, item in enumerate(wantlist):
            ItemRepository.update_sort_order(item['id'], idx)
        return True
