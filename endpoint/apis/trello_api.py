from .base_api import BaseApi
from urllib.parse import urlparse, quote_plus

class TrelloApi(BaseApi):
    board_id = None
    list_id = None
    image_to_upload = False
    
    # name of the incoming issue list
    trello_list = "Feedback"
    
    # to get a user token:
    # https://trello.com/1/connect?key=[key]&name=Frontback&response_type=token&scope=read,write

    def __init__(self, homepage, token, key):
        super(TrelloApi, self).__init__("https://api.trello.com/", homepage, {"key": key, "token": token})
        self.homepage = homepage
        self.board_id = self.get_board_id()
        self.list_id = self.lookup_list_id()
        
    def lookup_user_id(self, username):
        user = self.get("1/members/" + username)
        if user.get('id'):
            return user.get('id')
        return False
        
    def get_board_id(self):
        o = urlparse(self.homepage)
        short_id = quote_plus(o.path.split("/")[2])
        board = self.get("1/boards/" + short_id)
        if board.get('id'):
            return board.get('id')
        return False
        
    def get_lists(self):
        return self.get("1/boards/" + self.board_id + "/lists?fields=name")
        
    # find the list ID
    def lookup_list_id(self):
        lists = self.get_lists()
        for l in lists:
            if l['name'] == self.trello_list:
                return l['id']
        return False
        
    def get_labels(self):
        return self.get("1/boards/" + self.board_id + "/labels")
    
    # find label IDs
    def lookup_label_ids(self, tags):
        label_ids = []
        labels = self.get_labels()
        for l in labels:
            if l['name'] and l['name'] in tags:
                label_ids.append(l['id'])
        return label_ids

    def create_issue(self, title, body, meta, assignee_id = None, submitter_id = None, tags = None):
        data = {
            'idList': self.list_id,
            'name': title,
            'desc': body + "\n\n" + meta,
            'pos': 'top'
        }
        card_members = []
        if assignee_id:
            card_members.append(assignee_id)
        if submitter_id:
            card_members.append(submitter_id)
        if card_members:
            data['idMembers'] = ",".join(set(card_members))
                
        if tags:
            labels = self.lookup_label_ids(tags)
            if labels:
                data['idLabels'] = ",".join(labels)
            
        result = self.post("1/cards", data)
        if result.get('id'):
            i = result.get('id')
            # attach an image
            if self.image_to_upload:
                self.upload_image_to_card(i)
            # make sure @mentions in the comment trigger notifications
            mentions = self.find_mentions(body)
            if mentions:
                self.add_comment(i, "mentioning: " + ', '.join(mentions))
            return True
        return False

    def attach_image(self, img):
        # hang on to it for later
        self.image_to_upload = self.format_image(img)
        return False
        
    def upload_image_to_card(self, card_id):
        data = {}
        result = self.post("1/cards/" + card_id + '/attachments', data, self.image_to_upload)
        if result.get('id'):
            return True
        return False
        
    def add_comment(self, card_id, body):
        data = {
            'text': body
        }
        result = self.post("1/cards/" + card_id + '/actions/comments', data)
        if result.get('id'):
            return True
        return False
