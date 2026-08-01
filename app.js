/* =========================================================
   تسنيم — منطق التطبيق
   ========================================================= */
(function () {
  'use strict';

  /* ---------------- أدوات ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var toastT;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function sheet(html) {
    $('#sheet-in').innerHTML = html;
    $('#sheet').classList.add('open');
  }
  function closeSheet() { $('#sheet').classList.remove('open'); }

  function vibrate(ms) { if (navigator.vibrate) try { navigator.vibrate(ms || 12); } catch (e) {} }

  var CAP = window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins : null;

  /* ---------------- التاريخ الهجري ---------------- */
  var HIJRI_MONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  var AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  var AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس',
    'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  function gregToJD(y, m, d) {
    if (m < 3) { y -= 1; m += 12; }
    var a = Math.floor(y / 100), b = 2 - a + Math.floor(a / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524;
  }
  function toHijri(date, offset) {
    if (offset === undefined) offset = (Store.settings().hijriOffset || 0);
    // الأدق: تقويم أم القرى عبر Intl (مدعوم في أندرويد الحديث)
    try {
      var dd = new Date(date.getTime());
      dd.setDate(dd.getDate() + offset);
      var f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',
        { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
      var parts = {}, utc = new Date(Date.UTC(dd.getFullYear(), dd.getMonth(), dd.getDate(), 12));
      f.formatToParts(utc).forEach(function (x) { parts[x.type] = x.value; });
      if (parts.day && parts.month && parts.year) {
        var mn = parseInt(parts.month, 10);
        return { y: +parts.year, m: mn, d: +parts.day,
                 text: parseInt(parts.day, 10) + ' ' + HIJRI_MONTHS[mn - 1] + ' ' + parseInt(parts.year, 10) + 'هـ' };
      }
    } catch (e) { /* نكمّل بالحساب الجدولي */ }
    var jd = gregToJD(date.getFullYear(), date.getMonth() + 1, date.getDate()) + (offset || 0);
    var l = jd - 1948440 + 10632;
    var n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    var j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) +
            (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
    l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) -
            (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
    var mm = Math.floor((24 * l) / 709);
    var dd = l - Math.floor((709 * mm) / 24);
    var yy = 30 * n + j - 30;
    return { y: yy, m: mm, d: dd, text: dd + ' ' + HIJRI_MONTHS[mm - 1] + ' ' + yy + 'هـ' };
  }
  function gregText(d) {
    return AR_DAYS[d.getDay()] + '، ' + d.getDate() + ' ' + AR_MONTHS[d.getMonth()];
  }

  /* ---------------- مدن جاهزة (للعمل بدون تحديد موقع) ---------------- */
  var CITIES = [
    ['القاهرة', 30.0444, 31.2357, 'egypt'], ['الجيزة', 30.0131, 31.2089, 'egypt'],
    ['الإسكندرية', 31.2001, 29.9187, 'egypt'], ['المنصورة', 31.0409, 31.3785, 'egypt'],
    ['طنطا', 30.7865, 31.0004, 'egypt'], ['أسيوط', 27.1783, 31.1859, 'egypt'],
    ['سوهاج', 26.5591, 31.6957, 'egypt'], ['أسوان', 24.0889, 32.8998, 'egypt'],
    ['بورسعيد', 31.2653, 32.3019, 'egypt'], ['الزقازيق', 30.5877, 31.5020, 'egypt'],
    ['مكة المكرمة', 21.4225, 39.8262, 'makkah'], ['المدينة المنورة', 24.4686, 39.6142, 'makkah'],
    ['الرياض', 24.7136, 46.6753, 'makkah'], ['جدة', 21.4858, 39.1925, 'makkah'],
    ['دبي', 25.2048, 55.2708, 'dubai'], ['الدوحة', 25.2854, 51.5310, 'qatar'],
    ['الكويت', 29.3759, 47.9774, 'kuwait'], ['المنامة', 26.2285, 50.5860, 'kuwait'],
    ['عمّان', 31.9454, 35.9284, 'muslimWorld'], ['بيروت', 33.8938, 35.5018, 'muslimWorld'],
    ['دمشق', 33.5138, 36.2765, 'muslimWorld'], ['بغداد', 33.3152, 44.3661, 'karachi'],
    ['الخرطوم', 15.5007, 32.5599, 'egypt'], ['تونس', 36.8065, 10.1815, 'muslimWorld'],
    ['الجزائر', 36.7538, 3.0588, 'muslimWorld'], ['الرباط', 34.0209, -6.8416, 'muslimWorld'],
    ['طرابلس', 32.8872, 13.1913, 'muslimWorld'], ['إسطنبول', 41.0082, 28.9784, 'turkey'],
    ['لندن', 51.5074, -0.1278, 'isna'], ['باريس', 48.8566, 2.3522, 'muslimWorld'],
    ['برلين', 52.5200, 13.4050, 'muslimWorld'], ['نيويورك', 40.7128, -74.0060, 'isna']
  ];

  /* ---------------- الحالة ---------------- */
  var S = Store.load();
  var todayTimes = null, tickTimer = null, activeTab = 'wird';
  var PRAYERS = [
    { k: 'fajr', n: 'الفجر' }, { k: 'sunrise', n: 'الشروق', noAdhan: true },
    { k: 'dhuhr', n: 'الظهر' }, { k: 'asr', n: 'العصر' },
    { k: 'maghrib', n: 'المغرب' }, { k: 'isha', n: 'العشاء' }
  ];

  function fmt(d) {
    if (!d) return '--:--';
    var h = d.getHours(), m = d.getMinutes();
    var ap = h < 12 ? 'ص' : 'م';
    var hh = h % 12; if (hh === 0) hh = 12;
    return pad(hh) + ':' + pad(m) + ' ' + ap;
  }

  function computeTimes(date) {
    var st = Store.settings();
    if (st.lat === null) return null;
    return PrayerTimes.calculate({
      lat: st.lat, lng: st.lng, date: date || new Date(),
      method: st.method, asr: st.asr, adjust: st.adjust
    });
  }

  function nextPrayer() {
    if (!todayTimes) return null;
    var now = new Date();
    for (var i = 0; i < PRAYERS.length; i++) {
      var p = PRAYERS[i], t = todayTimes[p.k];
      if (t && t > now) return { key: p.k, name: p.n, at: t };
    }
    var tm = computeTimes(new Date(Date.now() + 86400000));
    return tm ? { key: 'fajr', name: 'الفجر', at: tm.fajr } : null;
  }

  function currentPrayer() {
    if (!todayTimes) return null;
    var now = new Date(), cur = null;
    PRAYERS.forEach(function (p) { if (todayTimes[p.k] && todayTimes[p.k] <= now) cur = p.k; });
    return cur;
  }

  /* =========================================================
     شاشة: ورد اليوم
     ========================================================= */
  function renderWird() {
    var k = Store.khatma(), ks = Store.khatmaStats();
    var st = Store.settings();
    var from = k.currentPage, to = Math.min(604, k.currentPage + k.pagesPerDay - 1);
    var a1 = Quran.ready() ? Quran.firstAyahOfPage(from) : null;
    var a2 = Quran.ready() ? Quran.lastAyahOfPage(to) : null;
    var now = new Date();

    var fromLabel = a1 ? 'سورة ' + Quran.surahName(a1.s) + ' — آية ' + a1.a
                       : 'صفحة ' + from;
    var toLabel = a2 ? 'سورة ' + Quran.surahName(a2.s) + ' — آية ' + a2.a
                     : 'صفحة ' + to;
    var opener = a1 ? a1.t.slice(0, 90) + (a1.t.length > 90 ? '…' : '')
                    : 'بِسْمِ اللهِ الرَّحْمَٰنِ الرَّحِيمِ';

    var bars = '';
    for (var j = 1; j <= 30; j++) {
      var startPage = JUZ_PAGES[j - 1], endPage = j < 30 ? JUZ_PAGES[j] - 1 : 604;
      var cls = from > endPage ? 'done' : (from > startPage ? 'partial' : '');
      bars += '<i class="' + cls + '"></i>';
    }

    var sal = Store.counterStats('salawat');
    var pr = Store.prayerStats();

    $('#s-wird').innerHTML =
      '<div class="topbar"><div><h1>ورد اليوم</h1>' +
        '<div class="sub">' + gregText(now) + ' • ' + toHijri(now).text + '</div></div>' +
        '<div class="acts"><button class="iconbtn" data-action="open-settings">⚙</button></div></div>' +
      '<div class="wrap">' +
        '<div class="jadwal">' +
          '<div class="wird-eyebrow"><span>الجزء ' + Quran.juzOfPage(from) + '</span>' +
            '<span>' + k.pagesPerDay + ' صفحة</span></div>' +
          '<div class="wird-from">' + esc(opener) + '</div>' +
          '<div class="wird-range"><span>من <b>' + esc(fromLabel) + '</b></span>' +
            '<span>صفحة ' + from + '</span></div>' +
          '<div class="wird-range" style="border:0;padding-top:6px"><span>إلى <b>' + esc(toLabel) + '</b></span>' +
            '<span>صفحة ' + to + '</span></div>' +
        '</div>' +
        '<div class="btnrow">' +
          '<button class="btn btn-primary" data-action="read-wird">اقرأ الورد</button>' +
          '<button class="btn btn-gold" data-action="finish-wird">أتممت القراءة</button>' +
        '</div>' +
        (ks.behindBy > 0 ? '<div class="late">⚠ أنت متأخر عن ختمتك بـ ' + ks.behindBy + ' ' +
          (ks.behindBy === 1 ? 'ورد' : 'أوراد') + '</div>' : '') +
        '<div class="foredge">' +
          '<div class="foredge-head"><span class="lbl">الختمة الحالية</span>' +
            '<span class="val">' + ks.progress + '٪ • بقي ' + ks.remainingWirds + ' ورد</span></div>' +
          '<div class="foredge-bars">' + bars + '</div>' +
          '<div class="foredge-cap"><span>الجزء ٣٠</span><span>ختمات مكتملة: ' + ks.completed + '</span><span>الجزء ١</span></div>' +
        '</div>' +
        '<div class="stats">' +
          statCard('الصلاة على النبي ﷺ اليوم', sal.today) +
          statCard('إجمالي الصلاة على النبي', sal.total) +
          statCard('صلوات اليوم', pr.today + '<small> / 5</small>') +
          statCard('أيام متتالية بالصلوات', pr.streak) +
        '</div>' +
        (Quran.ready() ? '' :
          '<div class="empty">📥 المصحف لسه مش متحمّل على الجهاز.<br>' +
          '<button class="btn btn-primary" style="margin-top:14px" data-action="download-quran">نزّل المصحف الآن</button></div>') +
      '</div>';
  }

  function statCard(k, v) {
    return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  }

  /* =========================================================
     شاشة: الأذكار
     ========================================================= */
  function renderAdhkar() {
    var cards = ADHKAR_CATEGORIES.map(function (c, i) {
      var s = Store.adhkarStats(c.id);
      var wide = (i < 2) ? ' wide' : '';
      return '<button class="cat tone-' + c.tone + wide + '" data-action="open-cat" data-cat="' + c.id + '">' +
        '<span class="n">اليوم ' + s.today + ' • الكل ' + s.total + '</span>' +
        '<span class="t">' + c.title + '</span><span class="s">' + c.subtitle + '</span></button>';
    }).join('');

    $('#s-adhkar').innerHTML =
      '<div class="topbar"><div><h1>الأذكار</h1><div class="sub">اضغط على الذكر لتنقيص العدّاد</div></div>' +
      '<div class="acts"><button class="iconbtn" data-action="open-stats">📊</button></div></div>' +
      '<div class="wrap"><div class="cats">' + cards +
      '<button class="cat tone-green wide" data-action="open-salawat">' +
        '<span class="n">اليوم ' + Store.counterStats('salawat').today + '</span>' +
        '<span class="t">الصلاة على النبي ﷺ</span><span class="s">عدّاد بصيغ متعددة</span></button>' +
      '<button class="cat tone-olive wide" data-action="open-tasbih">' +
        '<span class="n">اليوم ' + Store.counterStats('tasbih').today + '</span>' +
        '<span class="t">المسبحة الإلكترونية</span><span class="s">سبّح واحفظ العدد</span></button>' +
      '</div></div>';
  }

  var catState = null;
  function openCategory(id) {
    var cat = ADHKAR_CATEGORIES.filter(function (c) { return c.id === id; })[0];
    if (!cat) return;
    catState = { cat: cat, left: cat.items.map(function (it) { return it.count; }) };
    drawCategory();
    activeTab = 'adhkar-detail';
    showScreen('s-adhkar');
  }

  function drawCategory() {
    var cat = catState.cat;
    var total = catState.left.length;
    var done = catState.left.filter(function (n) { return n === 0; }).length;
    var cards = cat.items.map(function (it, i) {
      var left = catState.left[i];
      return '<div class="dhikr-card' + (left === 0 ? ' done' : '') + '" data-action="tap-dhikr" data-i="' + i + '">' +
        '<div class="dhikr-text">' + esc(it.text) + '</div>' +
        (it.virtue ? '<div class="dhikr-virtue">✦ ' + esc(it.virtue) + '</div>' : '') +
        '<div class="dhikr-meta"><span class="dhikr-src">' + esc(it.source || '') + '</span>' +
        '<span class="counter' + (left === 0 ? ' done' : '') + '">' + (left === 0 ? '✓' : left) + '</span></div></div>';
    }).join('');

    $('#s-adhkar').innerHTML =
      '<div class="topbar"><button class="iconbtn" data-action="back-adhkar">▶</button>' +
      '<div style="flex:1;text-align:center"><h1>' + cat.title + '</h1>' +
      '<div class="sub">' + done + ' من ' + total + '</div></div>' +
      '<button class="iconbtn" data-action="reset-cat">↻</button></div>' +
      '<div class="progressline"><i style="width:' + Math.round(done / total * 100) + '%"></i></div>' +
      '<div class="wrap">' + cards +
      '<div style="height:10px"></div>' +
      '<button class="btn btn-gold" style="width:100%" data-action="complete-cat">أتممت الأذكار</button>' +
      '</div>';
  }

  function tapDhikr(i) {
    if (catState.left[i] > 0) {
      catState.left[i]--;
      vibrate(10);
      var cat = catState.cat;
      if (cat.id === 'morning' || cat.id === 'evening') {
        // نتابع تسبيح/صلاة داخل الأذكار كمان
        var txt = cat.items[i].text;
        if (txt.indexOf('صَلِّ') > -1) Store.bump('salawat', 1);
        else if (txt.indexOf('سُبْحَانَ') > -1) Store.bump('tasbih', 1);
        else if (txt.indexOf('أَسْتَغْفِرُ') > -1) Store.bump('istighfar', 1);
      }
      if (catState.left.every(function (n) { return n === 0; })) {
        Store.markAdhkarDone(cat.id);
        toast('تقبّل الله — تم حفظ ختمة ' + cat.title);
      }
      drawCategory();
      var node = $$('.dhikr-card')[i];
      if (node) node.scrollIntoView({ block: 'nearest' });
    }
  }

  /* =========================================================
     شاشة: الصلاة
     ========================================================= */
  function renderPrayer() {
    var st = Store.settings();
    if (st.lat === null) {
      $('#s-prayer').innerHTML =
        '<div class="topbar"><h1>مواقيت الصلاة</h1></div>' +
        '<div class="empty">📍 حدّد موقعك الأول عشان نحسب المواقيت بدقة.<br>' +
        '<button class="btn btn-primary" style="margin-top:16px" data-action="locate">تحديد موقعي تلقائيًا</button>' +
        '<button class="btn btn-ghost" style="margin-top:10px" data-action="pick-city">اختر مدينتك من القائمة</button></div>';
      return;
    }
    todayTimes = computeTimes();
    var np = nextPrayer(), cur = currentPrayer();
    var now = new Date();

    var rows = PRAYERS.map(function (p) {
      var done = Store.prayerStats().day[p.k];
      return '<div class="prow' + (cur === p.k ? ' now' : '') + '">' +
        (p.noAdhan ? '<span class="check" style="opacity:.25">·</span>' :
          '<button class="check' + (done ? ' on' : '') + '" data-action="toggle-prayer" data-p="' + p.k + '">✓</button>') +
        '<span class="pn">' + p.n + '</span>' +
        '<span class="pt">' + fmt(todayTimes[p.k]) + '</span></div>';
    }).join('');

    $('#s-prayer').innerHTML =
      '<div class="topbar"><div><h1>مواقيت الصلاة</h1><div class="sub">' + esc(st.city || 'موقعك الحالي') + '</div></div>' +
      '<div class="acts"><button class="iconbtn" data-action="prayer-settings">⚙</button></div></div>' +
      '<div class="next-prayer"><div class="lbl">باقي على أذان ' + (np ? np.name : '—') + '</div>' +
        '<div class="cd" id="countdown">--:--:--</div>' +
        '<div class="nm">' + (np ? fmt(np.at) : '') + '</div></div>' +
      '<div class="hijri">' + gregText(now) + ' — ' + toHijri(now).text + '</div>' +
      '<div class="ptimes">' + rows + '</div>' +
      '<div class="wrap" style="padding-top:0">' +
        '<div class="section-title">التنبيهات</div>' +
        '<div class="list">' +
          switchItem('🔔', 'أذان عند دخول الوقت', 'adhanEnabled', st.adhanEnabled) +
          switchItem('🤍', 'الصلاة على النبي عند فتح الهاتف', 'unlockDhikrEnabled', st.unlockDhikrEnabled) +
          switchItem('✳', 'إشعار ذكر كل فترة', 'periodicDhikr', st.periodicDhikr) +
        '</div>' +
        '<div class="section-title">طريقة الحساب</div>' +
        '<div class="list"><div class="item"><span class="ic">🧭</span><span class="lb">الطريقة</span>' +
          '<select data-action="set-method">' + Object.keys(PrayerTimes.METHODS).map(function (m) {
            return '<option value="' + m + '"' + (st.method === m ? ' selected' : '') + '>' +
              PrayerTimes.METHODS[m].name + '</option>'; }).join('') + '</select></div>' +
        '<div class="item"><span class="ic">🕐</span><span class="lb">مذهب العصر</span>' +
          '<select data-action="set-asr">' +
          '<option value="standard"' + (st.asr === 'standard' ? ' selected' : '') + '>الجمهور</option>' +
          '<option value="hanafi"' + (st.asr === 'hanafi' ? ' selected' : '') + '>الحنفي</option></select></div>' +
        '<div class="item"><span class="ic">📍</span><span class="lb">تغيير الموقع</span>' +
          '<button class="rt" data-action="pick-city">تغيير</button></div></div>' +
      '</div>';
    startCountdown();
  }

  function switchItem(ic, label, key, on) {
    return '<div class="item"><span class="ic">' + ic + '</span><span class="lb">' + label + '</span>' +
      '<button class="switch' + (on ? ' on' : '') + '" data-action="toggle-setting" data-key="' + key + '"><i></i></button></div>';
  }

  function startCountdown() {
    clearInterval(tickTimer);
    tickTimer = setInterval(function () {
      var el = $('#countdown');
      if (!el) { clearInterval(tickTimer); return; }
      var np = nextPrayer();
      if (!np) return;
      var diff = Math.max(0, np.at - new Date());
      var h = Math.floor(diff / 3600000), m = Math.floor(diff % 3600000 / 60000), s = Math.floor(diff % 60000 / 1000);
      el.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
      if (diff < 1000) { setTimeout(renderPrayer, 1500); }
    }, 1000);
  }

  /* =========================================================
     شاشة: الفهرس
     ========================================================= */
  var indexTab = 'surah';
  function renderIndex() {
    var body;
    if (indexTab === 'surah') {
      body = SURAH_META.map(function (m) {
        return '<button class="srow" data-action="open-page" data-page="' + Quran.surahStartPage(m[0]) + '">' +
          '<span class="snum">' + m[0] + '</span>' +
          '<span class="sname">سورة ' + m[1] + '</span>' +
          '<span class="smeta">صفحة ' + Quran.surahStartPage(m[0]) + '<br>' + m[4] + ' • ' + m[2] + ' آية</span></button>';
      }).join('');
    } else {
      body = JUZ_PAGES.map(function (p, i) {
        var a = Quran.ready() ? Quran.firstAyahOfPage(p) : null;
        return '<button class="srow" data-action="open-page" data-page="' + p + '">' +
          '<span class="snum">' + (i + 1) + '</span>' +
          '<span class="sname">الجزء ' + (i + 1) + '</span>' +
          '<span class="smeta">صفحة ' + p + (a ? '<br>' + Quran.surahName(a.s) + ' ' + a.a : '') + '</span></button>';
      }).join('');
    }
    $('#s-index').innerHTML =
      '<div class="topbar"><h1>الفهرس</h1>' +
      '<div class="acts"><button class="iconbtn" data-action="goto-page">🔎</button></div></div>' +
      '<div class="tabs">' +
        '<button data-action="index-tab" data-t="surah" class="' + (indexTab === 'surah' ? 'on' : '') + '">السور</button>' +
        '<button data-action="index-tab" data-t="juz" class="' + (indexTab === 'juz' ? 'on' : '') + '">الأجزاء</button>' +
      '</div>' + body;
  }

  /* =========================================================
     شاشة: المزيد
     ========================================================= */
  function renderMore() {
    var st = Store.settings();
    var ks = Store.khatmaStats();
    var sal = Store.counterStats('salawat'), tas = Store.counterStats('tasbih'), ist = Store.counterStats('istighfar');
    var pr = Store.prayerStats();

    $('#s-more').innerHTML =
      '<div class="topbar"><h1>المزيد</h1></div>' +
      '<div class="wrap">' +
        '<div class="section-title">إحصائياتي</div>' +
        '<div class="stats">' +
          statCard('ختمات القرآن', ks.completed) +
          statCard('الصلاة على النبي ﷺ', sal.total) +
          statCard('التسبيح', tas.total) +
          statCard('الاستغفار', ist.total) +
          statCard('الصلوات المسجّلة', pr.total) +
          statCard('صفحة الختمة الحالية', ks.page) +
        '</div>' +
        '<div class="section-title">الختمة</div>' +
        '<div class="list">' +
          '<div class="item"><span class="ic">📖</span><span class="lb">صفحات الورد اليومي</span>' +
            '<select data-action="set-wird">' + [1, 2, 4, 5, 10, 15, 20, 21, 30, 40, 60].map(function (n) {
              return '<option value="' + n + '"' + (Store.khatma().pagesPerDay === n ? ' selected' : '') + '>' + n + ' صفحة</option>';
            }).join('') + '</select></div>' +
          '<button class="item" data-action="new-khatma"><span class="ic">＋</span><span class="lb">بدء ختمة جديدة</span></button>' +
          '<button class="item" data-action="open-bookmarks"><span class="ic">🔖</span><span class="lb">العلامات المرجعية</span>' +
            '<span class="rt">' + Store.bookmarks().length + '</span></button>' +
        '</div>' +
        '<div class="section-title">سنن قرآنية</div>' +
        '<div class="list">' +
          '<button class="item" data-action="open-page" data-page="' + Quran.surahStartPage(18) + '"><span class="ic">📗</span><span class="lb">سورة الكهف</span></button>' +
          '<button class="item" data-action="open-page" data-page="' + Quran.surahStartPage(67) + '"><span class="ic">📘</span><span class="lb">سورة الملك</span></button>' +
          '<button class="item" data-action="open-page" data-page="' + Quran.surahStartPage(36) + '"><span class="ic">📙</span><span class="lb">سورة يس</span></button>' +
          '<button class="item" data-action="open-page" data-page="' + Quran.surahStartPage(2) + '"><span class="ic">📕</span><span class="lb">سورة البقرة</span></button>' +
        '</div>' +
        '<div class="section-title">التنبيهات</div>' +
        '<div class="list">' +
          switchItem('🔔', 'أذان عند دخول الوقت', 'adhanEnabled', st.adhanEnabled) +
          switchItem('🤍', 'صلاة على النبي عند فتح الهاتف', 'unlockDhikrEnabled', st.unlockDhikrEnabled) +
          switchItem('🔊', 'صوت مع تنبيه فتح الهاتف', 'unlockSalawatSound', st.unlockSalawatSound) +
          switchItem('✳', 'إشعار ذكر كل فترة', 'periodicDhikr', st.periodicDhikr) +
          '<div class="item"><span class="ic">⏱</span><span class="lb">كل كام دقيقة</span>' +
            '<select data-action="set-periodic">' + [15, 30, 60, 120, 180, 360].map(function (n) {
              return '<option value="' + n + '"' + (st.periodicEveryMin === n ? ' selected' : '') + '>' + n + ' دقيقة</option>';
            }).join('') + '</select></div>' +
          '<div class="item"><span class="ic">🕒</span><span class="lb">أقل فاصل لتنبيه فتح الهاتف</span>' +
            '<select data-action="set-cooldown">' + [5, 15, 30, 60, 120].map(function (n) {
              return '<option value="' + n + '"' + (st.unlockCooldownMin === n ? ' selected' : '') + '>' + n + ' دقيقة</option>';
            }).join('') + '</select></div>' +
        '</div>' +
        '<div class="section-title">التاريخ الهجري</div>' +
        '<div class="list"><div class="item"><span class="ic">🌙</span><span class="lb">تعديل التاريخ الهجري</span>' +
          '<select data-action="set-hijri">' + [-2, -1, 0, 1, 2].map(function (n) {
            return '<option value="' + n + '"' + ((st.hijriOffset || 0) === n ? ' selected' : '') + '>' +
              (n > 0 ? '+' + n : n) + ' يوم</option>'; }).join('') + '</select></div>' +
          '<div class="item"><span class="ic">📅</span><span class="lb">اليوم</span>' +
            '<span class="rt">' + toHijri(new Date()).text + '</span></div></div>' +
        '<div class="section-title">المصحف</div>' +
        '<div class="list">' +
          '<button class="item" data-action="download-quran"><span class="ic">📥</span>' +
            '<span class="lb">' + (Quran.ready() ? 'إعادة تنزيل المصحف' : 'تنزيل المصحف للاستخدام بدون إنترنت') + '</span>' +
            '<span class="rt">' + (Quran.ready() ? 'محمّل ✓' : 'مطلوب') + '</span></button>' +
          '<div class="item"><span class="ic">🔤</span><span class="lb">حجم خط المصحف</span>' +
            '<select data-action="set-font">' + [20, 22, 24, 26, 28, 32, 36, 40].map(function (n) {
              return '<option value="' + n + '"' + (st.quranFontSize === n ? ' selected' : '') + '>' + n + '</option>';
            }).join('') + '</select></div>' +
        '</div>' +
        '<div class="section-title">البيانات</div>' +
        '<div class="list">' +
          '<button class="item" data-action="backup"><span class="ic">💾</span><span class="lb">نسخة احتياطية من إحصائياتي</span></button>' +
          '<button class="item" data-action="restore"><span class="ic">♻</span><span class="lb">استرجاع نسخة</span></button>' +
        '</div>' +
        '<div style="height:20px"></div>' +
      '</div>';
  }

  /* =========================================================
     المسبحة / الصلاة على النبي
     ========================================================= */
  var tapScreen = null;
  function openTap(kind) {
    tapScreen = kind;
    drawTap();
    showScreen('s-adhkar');
  }
  function drawTap() {
    var isSalawat = tapScreen === 'salawat';
    var name = isSalawat ? 'الصلاة على النبي ﷺ' : 'المسبحة';
    var s = Store.counterStats(isSalawat ? 'salawat' : 'tasbih');
    var phrase = isSalawat ? SALAWAT_FORMS[0] : Store.raw().tasbihPhrase;
    var opts = isSalawat ? SALAWAT_FORMS : ['سُبْحَانَ اللهِ وَبِحَمْدِهِ', 'سُبْحَانَ اللهِ الْعَظِيمِ',
      'الْحَمْدُ لِلَّهِ', 'اللهُ أَكْبَرُ', 'لَا إِلَٰهَ إِلَّا اللهُ', 'أَسْتَغْفِرُ اللهَ',
      'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ'];

    $('#s-adhkar').innerHTML =
      '<div class="topbar"><button class="iconbtn" data-action="back-adhkar">▶</button>' +
      '<div style="flex:1;text-align:center"><h1>' + name + '</h1>' +
      '<div class="sub">اليوم ' + s.today + ' • الإجمالي ' + s.total + '</div></div>' +
      '<button class="iconbtn" data-action="reset-tap">↻</button></div>' +
      '<div class="tap-area">' +
        '<div class="phrase" id="tap-phrase">' + esc(phrase) + '</div>' +
        '<button class="tap-circle" data-action="tap-count">' +
          '<span><span class="num" id="tap-num">' + s.today + '</span>' +
          '<div class="cap">اضغط للعدّ</div></span></button>' +
        '<select data-action="set-phrase" style="max-width:90%">' +
          opts.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select>' +
      '</div>' +
      '<div class="wrap" style="padding-top:0"><div class="stats">' +
        statCard('اليوم', s.today) + statCard('هذا الأسبوع', s.week) +
        statCard('هذا الشهر', s.month) + statCard('منذ استخدام البرنامج', s.total) +
      '</div></div>';
  }

  /* =========================================================
     قارئ المصحف
     ========================================================= */
  var readerPage = 1;
  function openReader(p) {
    if (!Quran.ready()) { toast('نزّل المصحف الأول من المزيد'); return; }
    readerPage = Math.min(604, Math.max(1, p));
    $('#reader').classList.add('open');
    drawReader();
  }
  function closeReader() { $('#reader').classList.remove('open'); }

  function deHarakat(t) {
    return t.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').replace(/\u0671/g, '\u0627');
  }
  function stripBasmala(text) {
    var toks = text.trim().split(/\s+/);
    if (toks.length < 5) return text;
    var bare = toks.slice(0, 4).map(deHarakat).join(' ');
    if (bare === '\u0628\u0633\u0645 \u0627\u0644\u0644\u0647 \u0627\u0644\u0631\u062d\u0645\u0646 \u0627\u0644\u0631\u062d\u064a\u0645') {
      return toks.slice(4).join(' ');
    }
    return text;
  }

  function drawReader() {
    var ayahs = Quran.page(readerPage);
    var st = Store.settings();
    var parts = [], buf = '';
    function flush() {
      if (buf) { parts.push('<div class="mushaf" style="font-size:' + st.quranFontSize + 'px">' + buf + '</div>'); buf = ''; }
    }
    ayahs.forEach(function (a) {
      var text = a.t;
      if (a.a === 1) {
        flush();
        parts.push('<div class="surah-head">سورة ' + Quran.surahName(a.s) + '</div>');
        if (a.s !== 1 && a.s !== 9) {
          text = stripBasmala(text);
          parts.push('<div class="basmala">بِسْمِ اللهِ الرَّحْمَٰنِ الرَّحِيمِ</div>');
        }
      }
      buf += esc(text) + '<span class="ayah-mark">' + a.a + '</span> ';
    });
    flush();
    var first = ayahs[0];
    $('#r-page').innerHTML = parts.join('') ||
      '<div class="empty">الصفحة دي مش متاحة — جرّب تنزّل المصحف تاني.</div>';
    $('#r-title').textContent = first ? 'سورة ' + Quran.surahName(first.s) + ' — الجزء ' + Quran.juzOfPage(readerPage) : '';
    $('#r-num').textContent = 'صفحة ' + readerPage + ' من 604';
    $('#r-page').scrollTop = 0;
    var bm = Store.bookmarks().some(function (b) { return b.page === readerPage; });
    var bmBtn = $('[data-action="reader-bookmark"]');
    if (bmBtn) bmBtn.style.opacity = bm ? 1 : .45;
  }

  /* السحب لتغيير الصفحة */
  (function () {
    var x0 = null;
    var el = $('#reader');
    el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 60) { dx > 0 ? nextPage() : prevPage(); }
      x0 = null;
    }, { passive: true });
  })();
  function nextPage() { if (readerPage < 604) { readerPage++; drawReader(); } }
  function prevPage() { if (readerPage > 1) { readerPage--; drawReader(); } }

  /* =========================================================
     الموقع
     ========================================================= */
  function locate() {
    toast('جارٍ تحديد الموقع…');
    var done = function (lat, lng) {
      Store.setSetting('lat', lat); Store.setSetting('lng', lng);
      var near = CITIES.map(function (c) {
        return { c: c, d: Math.abs(c[1] - lat) + Math.abs(c[2] - lng) };
      }).sort(function (a, b) { return a.d - b.d; })[0];
      if (near && near.d < 3) { Store.setSetting('city', near.c[0]); Store.setSetting('method', near.c[3]); }
      else Store.setSetting('city', 'موقعي');
      renderPrayer(); scheduleAll(); toast('تم تحديد الموقع');
    };
    if (CAP && CAP.Geolocation) {
      CAP.Geolocation.getCurrentPosition().then(function (p) { done(p.coords.latitude, p.coords.longitude); })
        .catch(function () { pickCity(); });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (p) { done(p.coords.latitude, p.coords.longitude); },
        function () { pickCity(); }, { timeout: 8000 });
    } else pickCity();
  }

  function pickCity() {
    sheet('<h3 style="margin:0 0 14px">اختر مدينتك</h3><div class="list">' +
      CITIES.map(function (c, i) {
        return '<button class="item" data-action="set-city" data-i="' + i + '"><span class="lb">' + c[0] + '</span></button>';
      }).join('') + '</div>');
  }

  /* =========================================================
     الإشعارات: الأذان + الذكر الدوري
     ========================================================= */
  function ensurePermission() {
    if (CAP && CAP.LocalNotifications) {
      return CAP.LocalNotifications.requestPermissions().then(function (r) { return r.display === 'granted'; });
    }
    if (window.Notification) {
      if (Notification.permission === 'granted') return Promise.resolve(true);
      return Notification.requestPermission().then(function (p) { return p === 'granted'; });
    }
    return Promise.resolve(false);
  }

  function scheduleAll() {
    var st = Store.settings();
    syncNative();
    scheduleAdhanNative();
    if (!CAP || !CAP.LocalNotifications) return;   // على الويب بنستخدم مؤقتات داخلية
    ensurePermission().then(function (ok) {
      if (!ok) return;
      CAP.LocalNotifications.cancel({ notifications: idsRange(1000, 1120) }).catch(function () {});
      var list = [], id = 1000;
      if (st.adhanEnabled && st.lat !== null) {
        for (var d = 0; d < 7; d++) {
          var date = new Date(); date.setDate(date.getDate() + d);
          var t = computeTimes(date);
          if (!t) continue;
          PRAYERS.forEach(function (p) {
            if (p.noAdhan || !t[p.k] || t[p.k] <= new Date()) return;
            list.push({
              id: id++, title: 'حان الآن موعد أذان ' + p.n,
              body: 'الله أكبر الله أكبر — ' + p.n + ' • ' + fmt(t[p.k]),
              schedule: { at: t[p.k], allowWhileIdle: true },
              sound: 'adhan.wav', smallIcon: 'ic_stat_mosque', channelId: 'adhan'
            });
          });
        }
      }
      if (st.periodicDhikr) {
        list.push({
          id: 1200, title: 'ذكر',
          body: QUICK_DHIKR[Math.floor(Math.random() * QUICK_DHIKR.length)],
          schedule: { every: minutesToEvery(st.periodicEveryMin), count: 999, allowWhileIdle: true },
          channelId: 'dhikr'
        });
      }
      if (list.length) CAP.LocalNotifications.schedule({ notifications: list }).catch(function (e) { console.warn(e); });
    });
  }
  function minutesToEvery(m) {
    if (m >= 60 && m % 60 === 0) return 'hour';
    return 'minute';
  }
  function idsRange(a, b) { var r = []; for (var i = a; i <= b; i++) r.push({ id: i }); return r; }

  /* ---------------- الجسر مع خدمات أندرويد ---------------- */
  function nativeAvailable() { return !!(CAP && CAP.Tasneem); }

  function syncNative() {
    if (!nativeAvailable()) return;
    var st = Store.settings();
    CAP.Tasneem.setConfig({
      unlockEnabled: st.unlockDhikrEnabled,
      soundEnabled: st.unlockSalawatSound,
      periodicEnabled: st.periodicDhikr,
      periodicMin: st.periodicEveryMin,
      adhanEnabled: st.adhanEnabled,
      cooldownMin: st.unlockCooldownMin
    }).catch(function () {});
  }

  function scheduleAdhanNative() {
    if (!nativeAvailable()) return;
    var st = Store.settings();
    if (!st.adhanEnabled || st.lat === null) { CAP.Tasneem.scheduleAdhan({ times: [] }).catch(function(){}); return; }
    var list = [];
    for (var d = 0; d < 7 && list.length < 35; d++) {
      var date = new Date(); date.setDate(date.getDate() + d);
      var t = computeTimes(date);
      if (!t) continue;
      PRAYERS.forEach(function (p) {
        if (p.noAdhan || !t[p.k] || t[p.k] <= new Date()) return;
        list.push({ name: p.n, at: t[p.k].getTime() });
      });
    }
    CAP.Tasneem.scheduleAdhan({ times: list }).catch(function () {});
  }

  /* يسحب عدد مرات الصلاة على النبي اللي اتسجّلت في الخلفية ويضيفها للإحصائيات */
  function pullNativeCounts() {
    if (!nativeAvailable()) return;
    CAP.Tasneem.pullCounts().then(function (r) {
      if (r && r.salawat > 0) {
        Store.bump('salawat', r.salawat);
        if (activeTab === 'wird') renderWird();
      }
    }).catch(function () {});
  }

  /* الصلاة على النبي عند العودة للتطبيق (بديل الويب لفتح الهاتف) */
  var lastUnlock = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    pullNativeCounts();
    var st = Store.settings();
    if (nativeAvailable()) return;   // على أندرويد الخدمة الأصلية هي اللي بتتولى دي
    if (!st.unlockDhikrEnabled) return;
    var now = Date.now();
    if (now - lastUnlock < st.unlockCooldownMin * 60000) return;
    lastUnlock = now;
    Store.bump('salawat', 1);
    if (st.unlockSalawatSound) playSalawat();
    toast('اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَىٰ نَبِيِّنَا مُحَمَّدٍ');
    if (activeTab === 'wird') renderWird();
  });

  var salawatAudio = null;
  function playSalawat() {
    try {
      if (!salawatAudio) { salawatAudio = new Audio('assets/audio/salawat.mp3'); salawatAudio.preload = 'auto'; }
      salawatAudio.currentTime = 0;
      salawatAudio.play().catch(function () {});
    } catch (e) {}
  }

  /* =========================================================
     التنقّل والأحداث
     ========================================================= */
  function showScreen(id) {
    $$('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    window.scrollTo(0, 0);
  }

  function go(tab) {
    activeTab = tab;
    catState = null; tapScreen = null;
    $$('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    if (tab === 'wird') { renderWird(); showScreen('s-wird'); }
    if (tab === 'adhkar') { renderAdhkar(); showScreen('s-adhkar'); }
    if (tab === 'prayer') { renderPrayer(); showScreen('s-prayer'); }
    if (tab === 'index') { renderIndex(); showScreen('s-index'); }
    if (tab === 'more') { renderMore(); showScreen('s-more'); }
  }

  document.addEventListener('click', function (e) {
    var tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { go(tabBtn.dataset.tab); return; }

    var t = e.target.closest('[data-action]');
    if (!t) { if (e.target.id === 'sheet') closeSheet(); return; }
    var a = t.dataset.action;

    switch (a) {
      case 'read-wird': openReader(Store.khatma().currentPage); break;
      case 'finish-wird': {
        var r = Store.completeWird();
        toast(r.finished ? '🎉 تمّت الختمة! تقبّل الله. ختماتك: ' + r.completed : 'تم تسجيل الورد — بارك الله فيك');
        renderWird(); break;
      }
      case 'download-quran': doDownload(); break;
      case 'open-cat': openCategory(t.dataset.cat); break;
      case 'back-adhkar': go('adhkar'); break;
      case 'tap-dhikr': tapDhikr(+t.dataset.i); break;
      case 'reset-cat': catState.left = catState.cat.items.map(function (i) { return i.count; }); drawCategory(); break;
      case 'complete-cat':
        Store.markAdhkarDone(catState.cat.id);
        toast('تم حفظ ' + catState.cat.title + ' ✓'); go('adhkar'); break;
      case 'open-salawat': openTap('salawat'); break;
      case 'open-tasbih': openTap('tasbih'); break;
      case 'tap-count': {
        var key = tapScreen === 'salawat' ? 'salawat' : 'tasbih';
        Store.bump(key, 1); vibrate(8);
        var s = Store.counterStats(key);
        $('#tap-num').textContent = s.today;
        if (s.today % 33 === 0) vibrate([20, 40, 20]);
        break;
      }
      case 'reset-tap': drawTap(); break;
      case 'toggle-prayer': Store.togglePrayer(t.dataset.p); renderPrayer(); break;
      case 'locate': locate(); break;
      case 'pick-city': pickCity(); break;
      case 'set-city': {
        var c = CITIES[+t.dataset.i];
        Store.setSetting('lat', c[1]); Store.setSetting('lng', c[2]);
        Store.setSetting('city', c[0]); Store.setSetting('method', c[3]);
        closeSheet(); renderPrayer(); scheduleAll(); break;
      }
      case 'toggle-setting': {
        var k = t.dataset.key;
        var val = !Store.settings()[k];
        Store.setSetting(k, val);
        t.classList.toggle('on', val);
        scheduleAll();
        if (k === 'adhanEnabled' && val) ensurePermission();
        break;
      }
      case 'index-tab': indexTab = t.dataset.t; renderIndex(); break;
      case 'open-page': openReader(+t.dataset.page); break;
      case 'goto-page': gotoPageSheet(); break;
      case 'do-goto': {
        var v = +$('#gp').value;
        if (v > 0 && v < 605) { closeSheet(); openReader(v); } else toast('اكتب رقم من 1 لـ 604');
        break;
      }
      case 'reader-close': closeReader(); if (activeTab === 'wird') renderWird(); break;
      case 'page-next': nextPage(); break;
      case 'page-prev': prevPage(); break;
      case 'reader-bookmark': {
        var added = Store.toggleBookmark(readerPage, 'صفحة ' + readerPage);
        toast(added ? 'تمت إضافة العلامة' : 'تم حذف العلامة');
        drawReader(); break;
      }
      case 'new-khatma':
        Store.startKhatma(Store.khatma().pagesPerDay);
        toast('بدأت ختمة جديدة — وفّقك الله'); renderMore(); break;
      case 'open-bookmarks': {
        var bs = Store.bookmarks();
        sheet('<h3 style="margin:0 0 14px">العلامات المرجعية</h3>' + (bs.length ?
          '<div class="list">' + bs.map(function (b) {
            return '<button class="item" data-action="open-page" data-page="' + b.page + '">' +
              '<span class="ic">🔖</span><span class="lb">' + b.label + '</span></button>'; }).join('') + '</div>'
          : '<div class="empty">لا توجد علامات بعد</div>'));
        break;
      }
      case 'open-settings': go('more'); break;
      case 'prayer-settings': go('more'); break;
      case 'open-stats': go('more'); break;
      case 'backup': {
        var data = Store.exportAll();
        sheet('<h3>نسخة احتياطية</h3><p style="font-size:13px;color:#6B7F76">انسخ النص ده واحتفظ بيه:</p>' +
          '<textarea style="width:100%;height:150px;font-size:11px" readonly>' + esc(data) + '</textarea>');
        break;
      }
      case 'restore':
        sheet('<h3>استرجاع نسخة</h3><textarea id="restore-box" style="width:100%;height:150px;font-size:11px"></textarea>' +
          '<button class="btn btn-primary" style="width:100%;margin-top:12px" data-action="do-restore">استرجاع</button>');
        break;
      case 'do-restore':
        if (Store.importAll($('#restore-box').value)) { toast('تم الاسترجاع'); closeSheet(); go('wird'); }
        else toast('النص غير صالح');
        break;
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t) return;
    switch (t.dataset.action) {
      case 'set-method': Store.setSetting('method', t.value); renderPrayer(); scheduleAll(); break;
      case 'set-asr': Store.setSetting('asr', t.value); renderPrayer(); scheduleAll(); break;
      case 'set-wird': {
        var k = Store.khatma(); k.pagesPerDay = +t.value;
        Store.setSetting('wirdPagesPerDay', +t.value); Store.save(); renderMore(); break;
      }
      case 'set-font': Store.setSetting('quranFontSize', +t.value); toast('تم تغيير حجم الخط'); break;
      case 'set-periodic': Store.setSetting('periodicEveryMin', +t.value); scheduleAll(); break;
      case 'set-cooldown': Store.setSetting('unlockCooldownMin', +t.value); break;
      case 'set-hijri': Store.setSetting('hijriOffset', +t.value); renderMore(); break;
      case 'set-phrase': {
        if (tapScreen === 'tasbih') { Store.raw().tasbihPhrase = t.value; Store.save(); }
        $('#tap-phrase').textContent = t.value; break;
      }
    }
  });

  function gotoPageSheet() {
    sheet('<h3 style="margin:0 0 12px">اذهب إلى صفحة</h3>' +
      '<input type="number" id="gp" min="1" max="604" placeholder="1 - 604" style="width:100%;max-width:100%">' +
      '<button class="btn btn-primary" style="width:100%;margin-top:12px" data-action="do-goto">اذهب</button>');
  }

  function doDownload() {
    sheet('<h3 style="margin:0 0 8px">تنزيل المصحف</h3>' +
      '<p style="font-size:13.5px;line-height:1.9;color:#6B7F76">هيتحمّل مرة واحدة بس (حوالي ٢ ميجا)، وبعدها التطبيق هيشتغل من غير إنترنت خالص.</p>' +
      '<div class="bar"><i id="dl-bar"></i></div><div id="dl-msg" style="font-size:13px">جارٍ البدء…</div>');
    Quran.download(function (p, msg) {
      var b = $('#dl-bar'), m = $('#dl-msg');
      if (b) b.style.width = p + '%';
      if (m) m.textContent = msg;
    }).then(function () {
      toast('تم تنزيل المصحف ✓');
      closeSheet(); go(activeTab === 'more' ? 'more' : 'wird');
    }).catch(function (err) {
      var m = $('#dl-msg');
      if (m) m.innerHTML = '<span style="color:#A8462F">فشل التنزيل — تأكد من الإنترنت وجرّب تاني.<br>' + esc(err.message) + '</span>';
    });
  }

  /* =========================================================
     الإقلاع
     ========================================================= */
  function boot() {
    Quran.load().then(function () {
      go('wird');
      if (Store.settings().lat !== null) { todayTimes = computeTimes(); scheduleAll(); }
      if (nativeAvailable()) {
        CAP.Tasneem.start().then(syncNative).catch(function () {});
        pullNativeCounts();
      }
      if (CAP && CAP.LocalNotifications) {
        CAP.LocalNotifications.createChannel &&
        CAP.LocalNotifications.createChannel({ id: 'adhan', name: 'الأذان', importance: 5,
          sound: 'adhan.wav', visibility: 1, vibration: true }).catch(function () {});
        CAP.LocalNotifications.createChannel &&
        CAP.LocalNotifications.createChannel({ id: 'dhikr', name: 'الأذكار', importance: 3,
          visibility: 1 }).catch(function () {});
      }
      // تحديث المواقيت عند تغيّر اليوم
      setInterval(function () {
        var d = Store.today();
        if (window.__lastDay && window.__lastDay !== d) { todayTimes = computeTimes(); scheduleAll(); go(activeTab); }
        window.__lastDay = d;
      }, 60000);
      window.__lastDay = Store.today();
    });
  }

  var booted = false;
  function bootOnce() { if (booted) return; booted = true; boot(); }
  document.addEventListener('DOMContentLoaded', bootOnce);
  if (document.readyState !== 'loading') bootOnce();
})();
