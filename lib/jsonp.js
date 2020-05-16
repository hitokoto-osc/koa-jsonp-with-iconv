/*!
 * jsonp.js
 * Created by Kilian Ciuffolo on Dec 25, 2013
 * Copyright (c) 2013 Kilian Ciuffolo, me@nailik.org
 */

'use strict'

const JSONPStream = require('./jsonp-stream')
const iconv = require('iconv-lite')
const flatstr = require('flatstr')
module.exports = function jsonp (options) {
  options = options || {}
  const callbackName = options.callbackName || 'callback'

  return async function _jsonp (ctx, next) {
    await next()

    let startChunk, endChunk
    let callback = ctx.query[callbackName]
    if (!ctx.body) {
      return
    }
    if (!callback) {
      if (ctx.query && ctx.query.charset) {
        if (typeof ctx.body.pipe === 'function') {
          if (ctx.query.charset.toLocaleLowerCase() === 'gbk') {
            ctx.type = ctx.type + '; charset=gbk'
            ctx.body.pipe(iconv.encodeStream('gbk'))
          }
        } else if (Buffer.isBuffer(ctx.body) || typeof ctx.body === 'string') {
          if (ctx.query.charset.toLocaleLowerCase() === 'gbk') {
            ctx.type = ctx.type + '; charset=gbk'
            ctx.body = iconv.encode(ctx.body, 'gbk')
          }
        } else {
          ctx.type = 'application/json'
          ctx.body = JSON.stringify(ctx.body)
          if (ctx.query.charset.toLocaleLowerCase() === 'gbk') {
            ctx.type = ctx.type + '; charset=gbk'
            ctx.body = iconv.encode(ctx.body, 'gbk')
          } else {
            ctx.body = flatstr(ctx.body)
          }
        }
      } else {
        if (Buffer.isBuffer(ctx.body) || typeof ctx.body === 'string') {
          if (ctx.query.charset.toLocaleLowerCase() === 'gbk') {
            ctx.type = ctx.type + '; charset=gbk'
            ctx.body = iconv.encode(ctx.body, 'gbk')
          }
        } else if (typeof ctx.body.pipe !== 'function') {
          ctx.type = 'application/json'
          ctx.body = flatstr(JSON.stringify(ctx.body))
        }
      }
      return
    }
    if (ctx.body == null) return

    ctx.type = 'text/javascript; charset=utf8'
    startChunk = ';' + callback + '('
    endChunk = ');'

    // handle streams
    if (typeof ctx.body.pipe === 'function') {
      ctx.body = ctx.body
        .pipe(new JSONPStream({
          startChunk: startChunk,
          endChunk: endChunk
        }))
      if (ctx.query && ctx.query.charset) {
        if (ctx.query.charset.toLocaleLowerCase() === 'gbk') {
          ctx.type = 'text/javascript; charset=gbk'
          ctx.body.pipe(iconv.encodeStream('gbk'))
        }
      }
    } else {
      ctx.body = startChunk + JSON.stringify(ctx.body, null, ctx.app.jsonSpaces) + endChunk

      // JSON parse vs eval fix. https://github.com/rack/rack-contrib/pull/37
      ctx.body = ctx.body
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
      if (ctx.query && ctx.query.charset) {
        if (ctx.query.charset.toLocaleLowerCase() === 'gbk') {
          ctx.body = iconv.encode(ctx.body, 'gbk')
          ctx.type = 'text/javascript; charset=gbk'
        }
      }
    }
  }
}
