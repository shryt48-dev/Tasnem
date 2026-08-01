/* =========================================================
   المصحف — يُنزَّل مرة واحدة ثم يعمل بدون إنترنت للأبد
   المصدر: api.alquran.cloud (نص عثماني + رقم الصفحة والجزء)
   ========================================================= */
(function (global) {
  'use strict';

  var DB_NAME = 'tasneem-quran', STORE = 'kv', VERSION = 1;
  var SOURCES = [
    'data/quran.json',                              // نسخة مرفقة داخل التطبيق (أوفلاين من أول تشغيل)
    'https://api.alquran.cloud/v1/quran/quran-uthmani',
    'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranuthmanihaf.json'
  ];
  var AUDIO_BASE = 'https://cdn.islamic.network/quran/audio/128/';

  var cache = null; // { ayahs: [...], pages: {n:[idx]}, surahs: {n:[idx]} }

  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, VERSION);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbGet(key) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        t.onsuccess = function () { res(t.result); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function idbSet(key, val) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key);
        t.onsuccess = function () { res(true); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }

  function index(ayahs) {
    var pages = {}, surahs = {};
    ayahs.forEach(function (a, i) {
      (pages[a.p] || (pages[a.p] = [])).push(i);
      (surahs[a.s] || (surahs[a.s] = [])).push(i);
    });
    cache = { ayahs: ayahs, pages: pages, surahs: surahs };
    return cache;
  }

  /* هل المصحف محمّل على الجهاز؟ */
  function isDownloaded() {
    if (cache) return Promise.resolve(true);
    return idbGet('ayahs').then(function (v) { return !!(v && v.length); }).catch(function () { return false; });
  }

  /* تحميل من التخزين المحلي */
  function load() {
    if (cache) return Promise.resolve(cache);
    return idbGet('ayahs').then(function (v) {
      if (v && v.length) return index(v);
      return null;
    }).catch(function () { return null; });
  }

  /* التنزيل من الإنترنت — مرة واحدة فقط */
  function download(onProgress) {
    onProgress = onProgress || function () {};
    onProgress(5, 'جارٍ الاتصال…');
    return fetchFirst(0).then(function (ayahs) {
      onProgress(85, 'جارٍ الحفظ على الجهاز…');
      return idbSet('ayahs', ayahs).then(function () {
        onProgress(100, 'تم');
        return index(ayahs);
      });
    });
  }

  function fetchFirst(i) {
    if (i >= SOURCES.length) return Promise.reject(new Error('تعذّر الاتصال بأي مصدر'));
    return fetch(SOURCES[i]).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(normalize).catch(function () { return fetchFirst(i + 1); });
  }

  /* توحيد شكل البيانات من أي مصدر */
  function normalize(json) {
    var out = [];
    if (json && json.data && json.data.surahs) {           // alquran.cloud
      json.data.surahs.forEach(function (s) {
        s.ayahs.forEach(function (a) {
          out.push({ s: s.number, a: a.numberInSurah, p: a.page, j: a.juz, t: a.text, sj: !!a.sajda });
        });
      });
    } else if (json && json.quran) {                        // fawazahmed0
      json.quran.forEach(function (a) {
        out.push({ s: a.chapter, a: a.verse, p: pageOf(a.chapter, a.verse), j: 0, t: a.text, sj: false });
      });
    }
    if (!out.length) throw new Error('شكل بيانات غير معروف');
    return out;
  }

  /* تقدير الصفحة من بيانات السور (يُستخدم فقط مع المصدر الاحتياطي) */
  function pageOf(surah, ayah) {
    var meta = global.SURAH_META;
    var start = meta[surah - 1][3], count = meta[surah - 1][2];
    var end = surah < 114 ? meta[surah][3] : 604;
    var span = Math.max(1, end - start + 1);
    return Math.min(604, start + Math.floor((ayah - 1) / count * span));
  }

  /* ---------- قراءة ---------- */
  function page(n) {
    if (!cache) return [];
    return (cache.pages[n] || []).map(function (i) { return cache.ayahs[i]; });
  }
  function surah(n) {
    if (!cache) return [];
    return (cache.surahs[n] || []).map(function (i) { return cache.ayahs[i]; });
  }
  function ayahRange(fromPage, toPage) {
    var out = [];
    for (var p = fromPage; p <= toPage; p++) out = out.concat(page(p));
    return out;
  }
  function firstAyahOfPage(n) {
    var l = page(n);
    return l.length ? l[0] : null;
  }
  function lastAyahOfPage(n) {
    var l = page(n);
    return l.length ? l[l.length - 1] : null;
  }
  function surahName(n) { return global.SURAH_META[n - 1][1]; }
  function surahStartPage(n) {
    if (cache && cache.surahs[n]) return cache.ayahs[cache.surahs[n][0]].p;
    return global.SURAH_META[n - 1][3];
  }
  function juzOfPage(n) {
    var a = firstAyahOfPage(n);
    if (a && a.j) return a.j;
    var jp = global.JUZ_PAGES, j = 1;
    for (var i = 0; i < jp.length; i++) if (n >= jp[i]) j = i + 1;
    return j;
  }
  function audioUrl(surahNo, ayahNo, reciter) {
    // رقم الآية المطلق مطلوب لهذا المصدر
    var abs = 0, meta = global.SURAH_META;
    for (var s = 1; s < surahNo; s++) abs += meta[s - 1][2];
    abs += ayahNo;
    return AUDIO_BASE + (reciter || 'ar.alafasy') + '/' + abs + '.mp3';
  }

  function clear() {
    cache = null;
    return idbSet('ayahs', null);
  }

  global.Quran = {
    isDownloaded: isDownloaded, load: load, download: download,
    page: page, surah: surah, ayahRange: ayahRange,
    firstAyahOfPage: firstAyahOfPage, lastAyahOfPage: lastAyahOfPage,
    surahName: surahName, surahStartPage: surahStartPage, juzOfPage: juzOfPage,
    audioUrl: audioUrl, clear: clear,
    ready: function () { return !!cache; }
  };
})(window);
