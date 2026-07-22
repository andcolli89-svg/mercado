'use strict';

const { RADAR_SOURCE_URL } = require('../config');

function clean(value = '') {
  return String(value).trim().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/^[<\[(]+|[>\]),.;]+$/g, '');
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u002F/g, '/')
    .replace(/\\u0026/g, '&').replace(/\\u003D/g, '=');
}

function money(value) {
  if (value === null || value === undefined || value === '') return '';
  let raw = String(value).trim().replace(/[^\d,.-]/g, '');
  if (!raw) return '';
  if (raw.includes(',') && raw.includes('.')) {
    raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (raw.includes(',')) raw = raw.replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2).replace('.', ',') : '';
}

function numeric(value) {
  const normalized = money(value);
  return normalized ? Number(normalized.replace(',', '.')) : NaN;
}

function safeDecode(value = '') {
  let result = String(value);
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(result);
      if (decoded === result) break;
      result = decoded;
    } catch { break; }
  }
  return result;
}

function itemIdFrom(text = '') {
  const raw = safeDecode(text);
  const patterns = [
    /(?:item_id|wid)(?:=|:)(MLB-?\d{6,})/i,
    /[?&#](?:item_id|wid)=MLB-?(\d{6,})/i,
    /"item_id"\s*:\s*"?(MLB-?\d{6,})/i,
    /"id"\s*:\s*"(MLB\d{6,})"/i,
    /\b(MLB-?\d{6,})\b/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    const value = String(match[1]).replace('-', '').toUpperCase();
    return value.startsWith('MLB') ? value : `MLB${value}`;
  }
  return '';
}

function attr(tag, name) {
  const match = String(tag).match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

function meta(html, key) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const name = attr(tag, 'property') || attr(tag, 'name') || attr(tag, 'itemprop');
    if (name.toLowerCase() === key.toLowerCase()) return attr(tag, 'content');
  }
  return '';
}

function stripTags(value = '') {
  return decodeHtml(String(value)).replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function absoluteUrl(value = '', base = RADAR_SOURCE_URL) {
  try { return new URL(decodeHtml(value), base).href; } catch { return ''; }
}

module.exports = { clean, decodeHtml, money, numeric, safeDecode, itemIdFrom, attr, meta, stripTags, absoluteUrl };
