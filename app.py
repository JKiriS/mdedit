# -*- coding: utf-8 -*-

import os
import sys
import datetime
import json
import traceback
import functools
import json
import uuid
import hashlib

import tornado.ioloop
import tornado.web
import tornado.httpserver
from tornado.options import define, options
import pymongo
from bson.objectid import ObjectId

cfg = json.load(open('self.cfg', 'r'))
ROOT = cfg['root']
BIN_ROOT = cfg['bin_root']
DOC_ROOT = cfg['doc_root']
FILE_ROOT = cfg['file_root']


class Session(object):

    def __init__(self, db, sid=None):
        self.db = db
        self.sid = str(sid)

        if not sid:
            self.sid = str(uuid.uuid4())

        self._s = self.db.session.find_one({'_id': self.sid})
        if not self._s:
            self._s = {}

    def get(self, key):
        return self._s.get(key)

    def set(self, key, value):
        self._s[key] = value
        self.db.session.update_one(
            {'_id': self.sid}, {'$set': {key: value}}, upsert=True)

    def pop(self, key):
        try:
            self._s.pop(key)
        except:
            pass
        self.db.session.update_one({'_id': self.sid}, {'$unset': {key: True}})


class BaseHandler(tornado.web.RequestHandler):

    @property
    def db(self):
        return self.application.mongo

    def initialize(self):
        session_id = self.get_secure_cookie("_session_id")
        self.session = Session(self.db, session_id)

    def get_current_user(self):
        return self.session.get('user')


def user_authenticated(func):
    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        if not self.current_user:
            if self.request.method in ("GET", "HEAD"):
                url = self.get_login_url()
                if "?" not in url:
                    if urlparse.urlsplit(url).scheme:
                        # if login url is absolute, make next absolute too
                        next_url = self.request.full_url()
                    else:
                        next_url = self.request.uri
                    url += "?" + urlencode(dict(next=next_url))
                self.redirect(url)
                return
            raise tornado.web.HTTPError(403)
        return func(self, *args, **kwargs)
    return wrapper


def admin_authenticated(func):
    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        if self.current_user and self.current_user['role'] == 0:
            return func(self, *args, **kwargs)
        raise tornado.web.HTTPError(403)
    return wrapper


class IndexHandler(BaseHandler):

    def get(self):
        self.render('index.html', parent=DOC_ROOT, ROOT=ROOT, BIN=BIN_ROOT)


class UploadHandler(BaseHandler):

    def post(self):
        res = {}
        try:
            title = self.get_argument('file.name')
            tmpPath = self.get_argument('file.path')
            parent = self.get_argument('parent', FILE_ROOT)

            paths = ['file', ] + tmpPath.split('/')[-2:]
            spath = '/'.join(paths)

            _pointIndex = title.find('.')
            if _pointIndex > 0:
                spath += title[_pointIndex:]

            os.symlink(tmpPath, '/home/jkiris/' + spath)
            url = '/' + spath

            fileInfo = dict(title=title,
                            type='file',
                            parent=parent,
                            size=self.get_argument('file.size'),
                            tmpPath=tmpPath,
                            MD5=self.get_argument('file.md5'),
                            contentType=self.get_argument('file.content_type'),
                            url=url,
                            create_time=datetime.datetime.now(),
                            )

            self.db.item.insert_one(fileInfo)
            res['status'] = 'ok'
            res['url'] = url
        except:
            res['status'] = 'error'
            res['error'] = traceback.format_exc()

        self.write(json.dumps(res))


class ArticleHandler(BaseHandler):

    def get(self, aid):
        if not aid:
            article = dict(title="新文档", content="")
        else:
            try:
                article = self.db.item.find_one(
                    {'_id': ObjectId(aid), 'type': 'doc'}
                )
            except:
                print traceback.format_exc()
                raise tornado.web.HTTPError(404)

        if not article:
            raise tornado.web.HTTPError(404)
        self.render('edit.html', article=article)

    @user_authenticated
    def post(self, aid):
        title = self.get_argument('title')
        content = self.get_argument('content')

        res = dict()
        if aid:
            try:
                self.db.item.update_one(
                    {'_id': ObjectId(aid)},
                    {'$set':
                        {
                            'title': title,
                            'content': content,
                            'last_modified': datetime.datetime.now(),
                            'last_visited': datetime.datetime.now(),
                        }
                     }
                )
                res['status'] = 'ok'
            except:
                res['status'] = 'error'
                res['error'] = traceback.format_exc()

        else:
            aid = ObjectId()
            article = dict(
                _id=aid,
                title=title,
                content=content,
                type='doc',
                url='/a/' + str(aid),
                parent=DOC_ROOT,
                create_time=datetime.datetime.now(),
                last_visited=datetime.datetime.now(),
                last_modified=datetime.datetime.now()
            )

            self.db.item.insert_one(article)

            res['status'] = 'ok'
            res['redirect'] = '/a/' + str(aid)

        self.write(json.dumps(res))


class LoginHandler(BaseHandler):

    def get(self):
        self.render('login.html')

    def post(self):
        self.login_user(self.get_argument("email"),
                        self.get_argument("password"))

    def login_user(self, email, password):
        user = self.db.user.find_one({'email': email})
        res = dict(status='ok')
        if not user:
            res['status'] = 'error'
            res['error'] = '账户尚未注册'
        else:
            if self.check_password(password, user):
                user.pop('password')
                self.session.set('user', user)
                self.set_secure_cookie("_session_id", self.session.sid)
                res['redirect'] = self.get_argument("next", "/")
            else:
                res['status'] = 'error'
                res['error'] = '密码错误'
        self.write(json.dumps(res))

    def check_password(self, password, user):
        return hashlib.md5(password).hexdigest() == user['password']


class LogoutHandler(BaseHandler):

    @user_authenticated
    def get(self):
        self.logout()
        self.redirect(self.get_argument("next", "/"))

    def logout(self):
        self.session.pop('user')


class ItemListHandler(BaseHandler):

    def post(self):
        parent = self.get_argument('parent', ROOT)

        _items = self.db.item.find(
            {'parent': parent}, ['title', 'parent', 'type', 'url'])
        items = map(lambda d: dict(_id=str(d['_id']), type=d['type'], title=d['title'],
                                   url=d.get('url', '')), _items)
        res = dict(status='ok', items=items)

        self.write(json.dumps(res))


class DirListHandler(BaseHandler):

    def post(self):
        _dirs = self.db.item.find(
            {'_id': {'$ne': ObjectId(ROOT)}, 'type': 'dir'}, ['title', 'parent'])
        dirs = map(lambda d: dict(_id=str(d['_id']), title=d[
                   'title'], parent=d['parent']), _dirs)
        res = dict(status='ok', dirs=dirs)

        self.write(json.dumps(res))


class NewDirHandler(BaseHandler):

    @user_authenticated
    def post(self):
        parent = self.get_argument('parent', ROOT)
        title = self.get_argument('title', '新建归档')
        newdir = dict(title=title, parent=parent, type='dir')

        res = dict(status='ok')
        try:
            newdir['_id'] = str(self.db.item.insert_one(newdir).inserted_id)
            res['item'] = newdir
        except:
            res['status'] = 'error'
            res['error'] = traceback.format_exc()

        self.write(json.dumps(res))


class NewDocHandler(BaseHandler):

    @user_authenticated
    def post(self):
        parent = self.get_argument('parent', DOC_ROOT)
        title = self.get_argument('title', '新建文档')
        aid = ObjectId()
        doc = dict(_id=aid, title=title, parent=parent, type='doc', content='',
                   url='/a/' + str(aid))

        res = dict(status='ok')
        try:
            self.db.item.insert_one(doc)
            doc['_id'] = str(aid)
            res['item'] = doc
        except:
            res['status'] = 'error'
            res['error'] = traceback.format_exc()

        self.write(json.dumps(res))


class RenameHandler(BaseHandler):

    @user_authenticated
    def post(self):
        target = self.get_argument('target')
        title = self.get_argument('title')

        res = dict(status='ok')
        try:
            self.db.item.update_one({'_id': ObjectId(target)}, {
                                    '$set': {'title': title}})
        except:
            res['status'] = 'error'
            res['error'] = traceback.format_exc()

        self.write(json.dumps(res))


class DeleteHandler(BaseHandler):

    @user_authenticated
    def post(self):
        targets = self.get_arguments('targets[]')
        completely = self.get_argument('completely', False)

        res = dict(status='ok')
        try:
            targets = map(lambda tid: ObjectId(tid), targets)
            if completely == 'true':
                self.db.item.delete_many({'_id': {'$in': targets}})
            else:
                self.db.item.update_many({'_id': {'$in': targets}}, {
                                         '$set': {'parent': BIN_ROOT}})
        except:
            res['status'] = 'error'
            res['error'] = traceback.format_exc()

        self.write(json.dumps(res))


class MoveHandler(BaseHandler):

    @user_authenticated
    def post(self):
        target = self.get_argument('target')
        sources = self.get_arguments('sources[]')

        res = dict(status='ok')
        try:
            sources = map(lambda sid: ObjectId(sid), sources)
            self.db.item.update_many({'_id': {'$in': sources}}, {
                                     '$set': {'parent': target}})
        except:
            res['status'] = 'error'
            res['error'] = traceback.format_exc()

        self.write(json.dumps(res))


class Application(tornado.web.Application):

    def __init__(self):
        settings = dict(
            template_path=os.path.join(os.path.dirname(__file__), "templates"),
            static_path=os.path.join(os.path.dirname(__file__), "static"),
            xsrf_cookies=True,
            cookie_secret=cfg['cookie_secret'],
            login_url="/login",
            autoload=False,
            debug=True,
        )

        handlers = [
            (r"/", IndexHandler),

            (r"/(favicon\.ico)", tornado.web.StaticFileHandler,
             dict(path=settings['static_path'])),

            (r"/login", LoginHandler),
            (r"/logout", LogoutHandler),

            (r"/upload", UploadHandler),

            (r"/a/(.*)", ArticleHandler),

            (r"/items", ItemListHandler),
            (r"/dirs", DirListHandler),
            (r"/newdir", NewDirHandler),
            (r"/newdoc", NewDocHandler),
            (r"/rename", RenameHandler),
            (r"/delete", DeleteHandler),
            (r"/move", MoveHandler),
        ]

        super(Application, self).__init__(handlers, **settings)

        client = pymongo.MongoClient(cfg['dbip'], cfg['dbport'])
        self.mongo = client['md']
        self.mongo.authenticate(cfg['user'], cfg['pwd'])


define("port", default=cfg['port'], help="run on the given port", type=int)

# temp = sys.stdout
# sys.stdout = open('/home/jkiris/mdedit/mdedit.log','w')

tornado.options.parse_command_line()


http_server = tornado.httpserver.HTTPServer(Application())
http_server.listen(options.port)
tornado.ioloop.IOLoop.current().start()
