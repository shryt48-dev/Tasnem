package com.tasneem.athkar;

import android.app.*;
import android.content.*;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.content.pm.ServiceInfo;
import androidx.core.app.NotificationCompat;

/**
 * خدمة تعمل في الخلفية بشكل دائم.
 * - تلتقط لحظة فتح المستخدم للهاتف (ACTION_USER_PRESENT) وتشغّل الصلاة على النبي ﷺ.
 * - تُظهر إشعار ذكر كل فترة يحددها المستخدم.
 * - تحفظ عدد المرات في SharedPreferences ليقرأها التطبيق ويضيفها للإحصائيات.
 *
 * ملاحظة مهمة: ACTION_USER_PRESENT لا يعمل من داخل AndroidManifest منذ أندرويد 8،
 * لذلك لا بد من تسجيله وقت التشغيل من خدمة تعمل في المقدمة (Foreground Service).
 */
public class DhikrService extends Service {

    public static final String PREFS = "tasneem_native";
    public static final String CH_ONGOING = "tasneem_ongoing";
    public static final String CH_DHIKR = "tasneem_dhikr";
    private static final int FG_ID = 4101;

    private UnlockReceiver unlockReceiver;
    private Handler periodicHandler;
    private MediaPlayer player;

    private static final String[] DHIKR = {
        "سُبْحَانَ اللهِ وَبِحَمْدِهِ، سُبْحَانَ اللهِ الْعَظِيمِ",
        "لَا إِلَٰهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ",
        "أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ",
        "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَىٰ نَبِيِّنَا مُحَمَّدٍ",
        "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ",
        "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
        "حَسْبِيَ اللهُ وَنِعْمَ الْوَكِيلُ",
        "اللهُ أَكْبَرُ كَبِيرًا وَالْحَمْدُ لِلَّهِ كَثِيرًا"
    };

    @Override public IBinder onBind(Intent i) { return null; }

    @Override public void onCreate() {
        super.onCreate();
        createChannels();
        // أندرويد 14 يشترط تحديد نوع الخدمة الأمامية
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(FG_ID, ongoingNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(FG_ID, ongoingNotification());
        }

        unlockReceiver = new UnlockReceiver();
        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_USER_PRESENT);   // فتح القفل
        f.addAction(Intent.ACTION_SCREEN_ON);      // إضاءة الشاشة
        // أندرويد 13+ يشترط تحديد إن كان المستقبِل مكشوفًا للتطبيقات الأخرى
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(unlockReceiver, f, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(unlockReceiver, f);
        }

        schedulePeriodic();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;   // لو النظام قفلها، تشتغل تاني
    }

    @Override public void onDestroy() {
        try { unregisterReceiver(unlockReceiver); } catch (Exception ignored) {}
        if (periodicHandler != null) periodicHandler.removeCallbacksAndMessages(null);
        if (player != null) { player.release(); player = null; }
        // إعادة تشغيل الخدمة
        sendBroadcast(new Intent(this, BootReceiver.class).setAction("com.tasneem.athkar.RESTART"));
        super.onDestroy();
    }

    /* ---------------- فتح الهاتف ---------------- */
    public class UnlockReceiver extends BroadcastReceiver {
        @Override public void onReceive(Context ctx, Intent intent) {
            SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
            if (!p.getBoolean("unlockEnabled", true)) return;

            long now = System.currentTimeMillis();
            long last = p.getLong("lastUnlockDhikr", 0);
            int cooldownMin = p.getInt("cooldownMin", 30);
            if (now - last < cooldownMin * 60_000L) return;

            p.edit()
             .putLong("lastUnlockDhikr", now)
             .putInt("pendingSalawat", p.getInt("pendingSalawat", 0) + 1)
             .apply();

            String text = "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَىٰ نَبِيِّنَا مُحَمَّدٍ";
            notifyDhikr("الصلاة على النبي ﷺ", text, 4102);

            if (p.getBoolean("soundEnabled", true)) playSalawat();
        }
    }

    private void playSalawat() {
        try {
            if (player != null) { player.release(); }
            // ضع ملف الصوت في: android/app/src/main/res/raw/salawat.mp3
            player = MediaPlayer.create(this, getResources().getIdentifier("salawat", "raw", getPackageName()));
            if (player == null) return;
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            player.setOnCompletionListener(mp -> { mp.release(); player = null; });
            player.start();
        } catch (Exception ignored) {}
    }

    /* ---------------- الذكر الدوري ---------------- */
    private void schedulePeriodic() {
        periodicHandler = new Handler();
        periodicHandler.postDelayed(new Runnable() {
            @Override public void run() {
                SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
                if (p.getBoolean("periodicEnabled", true)) {
                    String d = DHIKR[(int) (Math.random() * DHIKR.length)];
                    notifyDhikr("ذكر", d, 4103);
                }
                int every = getSharedPreferences(PREFS, MODE_PRIVATE).getInt("periodicMin", 60);
                periodicHandler.postDelayed(this, every * 60_000L);
            }
        }, getSharedPreferences(PREFS, MODE_PRIVATE).getInt("periodicMin", 60) * 60_000L);
    }

    /* ---------------- إشعارات ---------------- */
    private void createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel ongoing = new NotificationChannel(CH_ONGOING, "تشغيل مستمر",
                NotificationManager.IMPORTANCE_MIN);
        ongoing.setShowBadge(false);
        NotificationChannel dhikr = new NotificationChannel(CH_DHIKR, "الأذكار",
                NotificationManager.IMPORTANCE_DEFAULT);
        nm.createNotificationChannel(ongoing);
        nm.createNotificationChannel(dhikr);
    }

    private Notification ongoingNotification() {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CH_ONGOING)
                .setContentTitle("تسنيم يعمل")
                .setContentText("تنبيهات الأذكار والصلاة على النبي ﷺ مفعّلة")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }

    private void notifyDhikr(String title, String body, int id) {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, id, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(this, CH_DHIKR)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(id, n);
    }

    /* Handler محلي لتفادي استيراد إضافي */
    private static class Handler extends android.os.Handler {
        Handler() { super(android.os.Looper.getMainLooper()); }
    }
}
