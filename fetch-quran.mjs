/**
 * ينزّل المصحف كاملًا ويحفظه في www/data/quran.json
 * فيشتغل التطبيق أوفلاين من أول تشغيل بدون ما ينتظر أي تحميل.
 *
 * التشغيل:  npm run quran
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'www/data/quran.json';
const SOURCES = [
  'https://api.alquran.cloud/v1/quran/quran-uthmani',
  'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranuthmanihaf.json'
];

for (const url of SOURCES) {
  try {
    console.log('تنزيل من:', url);
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const json = await r.json();

    const surahs = json?.data?.surahs || json?.surahs;
    if (Array.isArray(surahs)) {
      const ayat = surahs.reduce((a, s) => a + s.ayahs.length, 0);
      if (surahs.length !== 114 || ayat !== 6236)
        throw new Error(`ناقص: ${surahs.length} سورة و${ayat} آية`);
      console.log('✓ تحقّق: 114 سورة و6236 آية');
    }

    mkdirSync('www/data', { recursive: true });
    writeFileSync(OUT, JSON.stringify(json));
    console.log('✓ حُفظ في', OUT);
    process.exit(0);
  } catch (e) {
    console.warn('تعذّر:', e.message);
  }
}

console.error('✗ فشل التنزيل — التطبيق سينزّل المصحف بنفسه عند أول تشغيل وهو متصل.');
process.exit(1);
