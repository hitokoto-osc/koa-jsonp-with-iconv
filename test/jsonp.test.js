/*!
 * jsonp.test.js
 * Created by Kilian Ciuffolo on Dec 25, 2013
 * Copyright (c) 2013 Kilian Ciuffolo, me@nailik.org
 */

'use strict'

const path = require('path')
const createReadStream = require('fs').createReadStream
const assert = require('chai').assert
const get = require('request').defaults({ json: true }).get
const post = require('request').defaults({ json: true }).post
const JSONStream = require('JSONStream')
const stringify = require('json-array-stream')
const Koa = require('koa')
const http = require('http')
const mount = require('koa-mount')
const jsonp = require('../')
const enableDestroy = require('server-destroy')

const { describe, it, before } = global

describe('jsonp()', () => {
  let server
  before(async function () {
    const app = new Koa()
    app.use(jsonp({ callbackName: 'my_cb_name' }))
    app.use(mount('/buffered', async function (ctx) {
      ctx.body = { foo: 'bar' }
    }))
    app.use(mount('/null', async function (ctx) {
      ctx.body = null
    }))
    app.use(mount('/streaming', async function (ctx) {
      ctx.body = createReadStream(path.join(__dirname, 'stream.json'))
        .pipe(JSONStream.parse('rows.*.value'))
        .pipe(stringify())
    }))
    server = http
      .createServer(app.callback())
      .listen(3000)
    enableDestroy(server)
  })

  let testCount = 0

  it('shouldn\'t do anything if callback is not provided / GET', function (done) {
    get('http://localhost:3000/buffered', function (err, res, body) {
      testCount++
      assert.equal(body.foo, 'bar')
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
      done(err)
    })
  })

  it('shouldn\'t do anything if callback is not provided / GET / Stream', function (done) {
    get('http://localhost:3000/streaming', function (err, res, body) {
      testCount++
      assert.lengthOf(body, 5)
      assert.equal(res.headers['content-type'], 'application/octet-stream')
      done(err)
    })
  })

  it('shouldn\'t do anything if callback is not provided / POST', function (done) {
    post('http://localhost:3000/buffered', function (err, res, body) {
      testCount++
      assert.equal(body.foo, 'bar')
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
      done(err)
    })
  })

  it('shouldn\'t do anything if this.body is undefined', function (done) {
    get('http://localhost:3000/404?my_cb_name=cb', function (err, res, body) {
      testCount++
      assert.equal(body, 'Not Found')
      assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
      done(err)
    })
  })

  it('shouldn\'t do anything if this.body is null', function (done) {
    get('http://localhost:3000/null?my_cb_name=cb', function (err, res, body) {
      testCount++
      assert.equal(res.statusCode, 204)
      done(err)
    })
  })

  it('should switch to JSONP mode if this.body is defined', function (done) {
    get('http://localhost:3000/buffered?my_cb_name=cb', function (err, res, body) {
      testCount++
      const data = JSON.parse(body.match(/cb\(([^)]+)\)/m)[1])
      assert.equal(data.foo, 'bar')
      assert.equal(res.headers['content-type'], 'text/javascript; charset=utf-8')
      done(err)
    })
  })

  it('should switch to JSONP mode if callback is provided / GET / Stream', function (done) {
    get('http://localhost:3000/streaming?my_cb_name=cb', function (err, res, body) {
      testCount++
      var data = JSON.parse(body.match(/cb\(([^)]+)\)/m)[1])
      assert.lengthOf(data, 5)
      assert.equal(res.headers['content-type'], 'text/javascript; charset=utf-8')
      done(err)
    })
  })

  function loopWaitToDestoryServer () {
    if (testCount === 7) {
      server.destory()
    } else {
      setTimeout(loopWaitToDestoryServer, 200)
    }
  }
  loopWaitToDestoryServer()
})
