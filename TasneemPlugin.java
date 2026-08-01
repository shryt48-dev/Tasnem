package com.tasneem.athkar;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * الجسر بين واجهة التطبيق (JS) وخدمات أندرويد.
 *
 * من جافاسكريبت:
 *   const { Tasneem } = Capacitor.Plugins;
 *   await Tasneem.start();
 *   await Tasneem.setConfig({ unlockEnabled:true, cooldownMin:30, soundEnabled:true,
 *                          periodicEnabled:true, periodicMin:60, adhanEnabled:true });
 *   await Tasneem.scheduleAdhan({ times:[{name:'الفجر', at: 1767...}, ...] });
 *   const { salawat } = await Tasneem.pullCounts();   // يرجّع العدد المتراكم ويصفّره
 */
@CapacitorPlugin(name = "Tasneem")
public class TasneemPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        Context ctx = getContext();
        Intent svc = new Intent(ctx, DhikrService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(svc);
        else ctx.startService(svc);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), DhikrService.class));
        call.resolve();
    }

    @PluginMethod
    public void setConfig(PluginCall call) {
        SharedPreferences.Editor e = prefs().edit();
        if (call.hasOption("unlockEnabled"))   e.putBoolean("unlockEnabled", call.getBoolean("unlockEnabled", true));
        if (call.hasOption("soundEnabled"))    e.putBoolean("soundEnabled", call.getBoolean("soundEnabled", true));
        if (call.hasOption("periodicEnabled")) e.putBoolean("periodicEnabled", call.getBoolean("periodicEnabled", true));
        if (call.hasOption("adhanEnabled"))    e.putBoolean("adhanEnabled", call.getBoolean("adhanEnabled", true));
        if (call.hasOption("cooldownMin"))     e.putInt("cooldownMin", call.getInt("cooldownMin", 30));
        if (call.hasOption("periodicMin"))     e.putInt("periodicMin", call.getInt("periodicMin", 60));
        e.apply();
        call.resolve();
    }

    @PluginMethod
    public void pullCounts(PluginCall call) {
        int s = prefs().getInt("pendingSalawat", 0);
        prefs().edit().putInt("pendingSalawat", 0).apply();
        JSObject r = new JSObject();
        r.put("salawat", s);
        call.resolve(r);
    }

    @PluginMethod
    public void scheduleAdhan(PluginCall call) {
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        JSArray times = call.getArray("times");
        if (times == null) { call.reject("times مطلوبة"); return; }

        // إلغاء القديم
        for (int i = 0; i < 40; i++) {
            PendingIntent old = PendingIntent.getBroadcast(ctx, 8000 + i,
                    new Intent(ctx, AdhanReceiver.class),
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (old != null) am.cancel(old);
        }

        try {
            for (int i = 0; i < times.length() && i < 40; i++) {
                JSONObject o = (JSONObject) times.get(i);
                long at = o.getLong("at");
                if (at <= System.currentTimeMillis()) continue;
                Intent in = new Intent(ctx, AdhanReceiver.class);
                in.putExtra("prayer", o.getString("name"));
                in.putExtra("at", at);
                PendingIntent pi = PendingIntent.getBroadcast(ctx, 8000 + i, in,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                } else {
                    am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
                }
            }
            call.resolve();
        } catch (Exception ex) {
            call.reject(ex.getMessage());
        }
    }

    /** جدولة احتياطية بعد ٢٤ ساعة لو المستخدم مفتحش التطبيق. */
    static void rescheduleNextDay(Context ctx, String prayer, long at) {
        if (at <= 0) return;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        Intent in = new Intent(ctx, AdhanReceiver.class);
        in.putExtra("prayer", prayer);
        in.putExtra("at", at + 86_400_000L);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 8500 + Math.abs(prayer.hashCode() % 100), in,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at + 86_400_000L, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, at + 86_400_000L, pi);
            }
        } catch (SecurityException ignored) { }
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(DhikrService.PREFS, Context.MODE_PRIVATE);
    }
}
