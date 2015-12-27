# -*- coding: utf-8 -*-

import os
import sys
import datetime
import json
import traceback

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


class BaseHandler(tornado.web.RequestHandler):
    @property
    def db(self):
        return self.application.mongo


class IndexHandler(BaseHandler):
    def get(self):
        self.render('index.html', parent=DOC_ROOT, ROOT=ROOT)


class UploadHandler(BaseHandler):
    def post(self):
        res = {}
        try:
            title = self.get_argument('file.name')
            tmpPath = self.get_argument('file.path')

            paths = ['file',] + tmpPath.split('/')[-2:]
            spath = '/'.join(paths)

            _pointIndex = title.find('.')
            if _pointIndex > 0:
	        spath += title[_pointIndex:]
            
            os.symlink(tmpPath, '/home/jkiris/' + spath)
            url = '/' + spath

            fileInfo = dict(title=title,
            	type='file',
            	parent=FILE_ROOT,
                size=self.get_argument('file.size'),
                tmpPath=tmpPath,
                MD5=self.get_argument('file.md5'),
                contentType=self.get_argument('file.content_type'),
                url=url,
                create_time = datetime.datetime.now(),
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
                title = title,
                content = content,
                type='doc',
                url='/a/' + str(aid),
                parent=DOC_ROOT,
                create_time = datetime.datetime.now(),
                last_visited = datetime.datetime.now(),
                last_modified = datetime.datetime.now()
            )

            self.db.item.insert_one(article)

            res['status'] = 'ok'
            res['redirect'] = '/a/' + str(aid)

        self.write(json.dumps(res))


class LoginHandler(BaseHandler):
    def get(self):
        self.render('index.html')

    def post(self):
        pass


class ItemListHandler(BaseHandler):
    def post(self):
        parent = self.get_argument('parent', ROOT)

        _items = self.db.item.find({'parent': parent}, ['title', 'parent', 'type', 'url'])
        items = map(lambda d: dict(_id=str(d['_id']), type=d['type'], title=d['title'], 
        	url=d.get('url', '')), _items)
        res = dict(status='ok', items=items)

        self.write(json.dumps(res))


class DirListHandler(BaseHandler):
    def post(self):
        _dirs = self.db.item.find({'_id': {'$ne': ObjectId(ROOT)}, 'type': 'dir'}, ['title', 'parent'])
        dirs = map(lambda d: dict(_id=str(d['_id']), title=d['title'], parent=d['parent']), _dirs)
        res = dict(status='ok', dirs=dirs)

        self.write(json.dumps(res))


class NewDirHandler(BaseHandler):
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
    def post(self):
        parent = self.get_argument('parent', ROOT)
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
    def post(self):
        target = self.get_argument('target')
        title = self.get_argument('title')

        res = dict(status='ok')
        try:
            self.db.item.update_one({'_id': ObjectId(target)}, {'$set': {'title': title}})
        except:
            res['status'] = 'error'
            res['error'] = traceback.format_exc()

        self.write(json.dumps(res))


class DeleteHandler(BaseHandler):
    def post(self):
        targets = self.get_arguments('targets[]')
        completely = self.get_argument('completely', False)

        res = dict(status='ok')
        try:
            targets = map(lambda tid: ObjectId(tid), targets)
            self.db.item.update_many({'_id': {'$in': targets}}, {'$set':{'parent': BIN_ROOT}})
        except:
            res['status'] = 'error'
            res['error'] = traceback.format_exc()

        self.write(json.dumps(res))


class MoveHandler(BaseHandler):
    def post(self):
        target = self.get_argument('target')
        sources = self.get_arguments('sources[]')

        res = dict(status='ok')
        try:
            sources = map(lambda sid: ObjectId(sid), sources)
            self.db.item.update_many({'_id': {'$in': sources}}, {'$set':{'parent': target}})
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
            login_url="/account/login",
            autoload=False,
            debug=True,
        )

        handlers = [
            (r"/", IndexHandler),

            (r"/(favicon\.ico)", tornado.web.StaticFileHandler, dict(path=settings['static_path'])),

            (r"/account/login", LoginHandler),

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
