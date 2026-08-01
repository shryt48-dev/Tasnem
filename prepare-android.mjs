/**
 * يجهّز مشروع أندرويد بالكامل بعد `npx cap add android`:
 *  - ينسخ ملفات جافا الأصلية في مكانها
 *  - يستبدل MainActivity
 *  - يضيف الأذونات والخدمات في AndroidManifest
 *  - يضبط اسم التطبيق بالعربية
 *  - ينشئ مجلد res/raw لملفات الأذان
 *
 * التشغيل:  node scripts/prepare-android.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const PKG = 'com.tasneem.athkar';
const MAIN = 'android/app/src/main';
const JAVA = path.join(MAIN, 'java', ...PKG.split('.'));
const SRC = 'android-native';

if (!fs.existsSync('android')) {
  console.error('✗ مجلد android غير موجود. شغّل أولًا:  npx cap add android');
  process.exit(1);
}

fs.mkdirSync(JAVA, { recursive: true });
fs.mkdirSync(path.join(MAIN, 'res/raw'), { recursive: true });

/* 1) ملفات جافا */
for (const f of ['DhikrService.java', 'BootReceiver.java', 'AdhanReceiver.java', 'TasneemPlugin.java']) {
  fs.copyFileSync(path.join(SRC, f), path.join(JAVA, f));
  console.log('✓ نُسخ', f);
}
fs.writeFileSync(
  path.join(JAVA, 'MainActivity.java'),
  fs.readFileSync(path.join(SRC, 'MainActivity-snippet.java'), 'utf8')
);
console.log('✓ حُدّث MainActivity.java');

/* 2) AndroidManifest */
const mf = path.join(MAIN, 'AndroidManifest.xml');
let xml = fs.readFileSync(mf, 'utf8');

if (xml.includes('DhikrService')) {
  console.log('• AndroidManifest معدّل مسبقًا — تخطّي');
} else {
  const perms = [
    'INTERNET', 'POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM',
    'RECEIVE_BOOT_COMPLETED', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_SPECIAL_USE',
    'WAKE_LOCK', 'VIBRATE', 'ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION',
    'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'
  ].filter(p => !xml.includes(`permission.${p}"`))
   .map(p => `    <uses-permission android:name="android.permission.${p}"/>`).join('\n');

  const components = `
        <service
            android:name=".DhikrService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="تنبيهات الأذكار والصلاة على النبي عند فتح الجهاز"/>
        </service>

        <receiver
            android:name=".BootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED"/>
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED"/>
                <action android:name="com.tasneem.athkar.RESTART"/>
            </intent-filter>
        </receiver>

        <receiver
            android:name=".AdhanReceiver"
            android:enabled="true"
            android:exported="false"/>
`;

  xml = xml.replace('</application>', components + '    </application>');
  xml = xml.replace('</manifest>', perms + '\n</manifest>');
  fs.writeFileSync(mf, xml);
  console.log('✓ حُدّث AndroidManifest.xml');
}

/* 3) اسم التطبيق بالعربية */
const strings = path.join(MAIN, 'res/values/strings.xml');
if (fs.existsSync(strings)) {
  let s = fs.readFileSync(strings, 'utf8')
    .replace(/(<string name="app_name">)[^<]*(<\/string>)/, '$1تسنيم$2')
    .replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, '$1تسنيم$2');
  fs.writeFileSync(strings, s);
  console.log('✓ اسم التطبيق: تسنيم');
}

/* 4) تذكير بملفات الصوت */
const raw = path.join(MAIN, 'res/raw');
const have = fs.readdirSync(raw);
const need = ['adhan.mp3', 'adhan_fajr.mp3', 'salawat.mp3'].filter(f => !have.includes(f));
if (need.length) {
  console.log('\n! ملفات الصوت الناقصة (التطبيق يعمل بدونها لكن بلا صوت):');
  need.forEach(f => console.log('   ' + path.join(raw, f)));
}

console.log('\n✓ جاهز. ابنِ الآن بـ:  cd android && ./gradlew assembleDebug');
