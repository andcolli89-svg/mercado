'use strict';

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    ...extra
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, cors(headers));
  res.end(body);
}

function json(res, status, value) {
  send(res, status, JSON.stringify(value), { 'Content-Type': 'application/json; charset=utf-8' });
}

async function fetchWithTimeout(url, options = {}, timeout = 20000) {
  return fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeout), ...options });
}

module.exports = { cors, send, json, fetchWithTimeout };
