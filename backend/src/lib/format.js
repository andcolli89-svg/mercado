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

function localizedNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (value === null || value === undefined || value === '') return NaN;

  let raw = String(value).trim().replace(/[^\d,.-]/g, '');
  if (!raw) return NaN;

  const negative = raw.startsWith('-');
  raw = raw.replace(/-/g, '');
  const commaCount = (raw.match(/,/g) || []).length;
  const dotCount = (raw.match(/\./g) || []).length;

  if (commaCount && dotCount) {
    // O último separador é o decimal; os anteriores são milhares.
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      raw = raw.replace(/\./g, '').replace(/,(?=[^,]*$)/, '.').replace(/,/g, '');
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (commaCount) {
    const groups = raw.split(',');
    const decimalDigits = groups[groups.length - 1].length;
    if (commaCount > 1 && groups.slice(1).every(group => group.length === 3)) {
      raw = groups.join('');
    } else if (decimalDigits === 1 || decimalDigits === 2) {
      raw = `${groups.slice(0, -1).join('')}.${groups[groups.length - 1]}`;
    } else if (decimalDigits === 3 && groups[0] !== '0') {
      // Em páginas brasileiras, "2,500" também pode representar 2.500.
      raw = groups.join('');
    } else {
      raw = groups.join('');
    }
  } else if (dotCount) {
    const groups = raw.split('.');
    const decimalDigits = groups[groups.length - 1].length;
    if (dotCount > 1 && groups.slice(1).every(group => group.length === 3)) {
      raw = groups.join('');
    } else if (dotCount > 1 && (decimalDigits === 1 || decimalDigits === 2)) {
      raw = `${groups.slice(0, -1).join('')}.${groups[groups.length - 1]}`;
    } else if (dotCount === 1 && decimalDigits === 3 && groups[0].length >= 1 && groups[0].length <= 3 && groups[0] !== '0') {
      // O Mercado Livre escreve milhares como "2.500 reais" em atributos HTML.
      raw = groups.join('');
    }
  }

  const parsed = Number(`${negative ? '-' : ''}${raw}`);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function money(value) {
  const n = localizedNumber(value);
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

module.exports = { clean, decodeHtml, localizedNumber, money, numeric, safeDecode, itemIdFrom, attr, meta, stripTags, absoluteUrl };
