package com.tasneem.athkar;

import android.app.*;
import android.content.*;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

/**
 * يستقبل منبّه وقت الصلاة، يرفع إشعارًا بأهمية عالية ويشغّل الأذان كاملًا.
 * يُجدوَل من TasneemPlugin عبر AlarmManager.setExactAndAllowWhileIdle.
 */
public class AdhanReceiver extends BroadcastReceiver {

    public static final String CH_ADHAN = "tasneem_adhan";

    @Override public void onReceive(Context ctx, Intent intent) {
        String prayer = intent.getStringExtra("prayer");
        if (prayer == null) prayer = "الصلاة";

        SharedPreferences p = ctx.getSharedPreferences(DhikrService.PREFS, Context.MODE_PRIVATE);
        if (!p.getBoolean("adhanEnabled", true)) return;

        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK, "tasneem:adhan");
        wl.acquire(3 * 60 * 1000L);

        createChannel(ctx);
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent pi = PendingIntent.getActivity(ctx, 7001, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification n = new NotificationCompat.Builder(ctx, CH_ADHAN)
                .setContentTitle("حان الآن موعد أذان " + prayer)
                .setContentText("اللهم صلِّ وسلّم على نبينا محمد")
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setFullScreenIntent(pi, true)
                .setContentIntent(pi)
                .build();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(7001, n);

        // تشغيل الأذان: ضع الملف في res/raw/adhan.mp3 (وres/raw/adhan_fajr.mp3 لأذان الفجر)
        try {
            String name = prayer.contains("الفجر") ? "adhan_fajr" : "adhan";
            int resId = ctx.getResources().getIdentifier(name, "raw", ctx.getPackageName());
            if (resId == 0) resId = ctx.getResources().getIdentifier("adhan", "raw", ctx.getPackageName());
            if (resId != 0) {
                MediaPlayer mp = MediaPlayer.create(ctx, resId);
                if (mp != null) {
                    mp.setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
                    mp.setOnCompletionListener(m -> m.release());
                    mp.start();
                }
            }
        } catch (Exception ignored) {}

        // إعادة جدولة اليوم التالي يتولاها التطبيق عند فتحه، ونجدول احتياطيًا بعد 24 ساعة
        TasneemPlugin.rescheduleNextDay(ctx, prayer, intent.getLongExtra("at", 0));

        if (wl.isHeld()) wl.release();
    }

    private void createChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel ch = new NotificationChannel(CH_ADHAN, "الأذان",
                NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("تنبيه دخول وقت الصلاة");
        ch.enableVibration(true);
        ch.setSound(null, null);   // الصوت بنشغّله بأنفسنا عشان الأذان أطول من 30 ثانية
        nm.createNotificationChannel(ch);
    }
}
