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


class BaseHandler(tornado.web.RequestHandler):
    @property
    def db(self):
        return self.application.mongo


class IndexHandler(BaseHandler):
    def get(self):
        self.redirect('/a')


class ArticleHandler(BaseHandler):
    def get(self, aid):
        if not aid:
            article = dict(title="新文档", content="")
        else:
            try:
                article = self.db.article.find_one(
                    {'_id': ObjectId(aid)}
                )
            except:
                print traceback.format_exc()
                raise tornado.web.HTTPError(404)

        if not article:
            raise tornado.web.HTTPError(404)
        self.render('index.html', article=article)

    def post(self, aid):
        title = self.get_argument('title')
        content = self.get_argument('content')

        res = dict()
        if aid:
            try:
                self.db.article.update_one(
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
                res['error'] = ''

        else:
            article = dict(
                title = title,
                content = content,
                create_time = datetime.datetime.now(),
                last_visited = datetime.datetime.now(),
                last_modified = datetime.datetime.now()
            )
            aid = str(self.db.article.insert_one(article).inserted_id)

            res['status'] = 'ok'
            res['redirect'] = '/a/' + aid

        self.write(json.dumps(res))


class ListHandler(BaseHandler):
    def get(self):
        articles = self.db.article.find()
        self.render('list.html', articles=articles)


class LoginHandler(BaseHandler):
    def get(self):
        self.render('index.html')

    def post(self):
        pass


class Application(tornado.web.Application):
    def __init__(self):
        settings = dict(
            template_path=os.path.join(os.path.dirname(__file__), "templates"),
            static_path=os.path.join(os.path.dirname(__file__), "static"),
            xsrf_cookies=True,
            cookie_secret="61oETzKXQAGaYdkL5gEmGeJJFuYh7EQnp2XdTP1o/Vo=",
            login_url="/account/login",
            autoload=False,
            debug=True,
        )

        handlers = [
            (r"/", IndexHandler),

            (r"/(favicon\.ico)", tornado.web.StaticFileHandler, dict(path=settings['static_path'])),

            (r"/account/login", LoginHandler),

            (r"/a/(.*)", ArticleHandler),
            (r"/l", ListHandler),
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
