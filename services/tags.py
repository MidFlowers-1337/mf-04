from models.repository import TagRepository


class TagService:
    @staticmethod
    def list_tags():
        return TagRepository.list_tags()

    @staticmethod
    def create_tag(name):
        if not name or not name.strip():
            raise ValueError('tag name is required')
        return TagRepository.get_or_create(name.strip())

    @staticmethod
    def rename_tag(tag_id, new_name):
        if not new_name or not new_name.strip():
            raise ValueError('tag name is required')
        return TagRepository.rename_tag(tag_id, new_name.strip())

    @staticmethod
    def delete_tag(tag_id):
        return TagRepository.delete_tag(tag_id)
