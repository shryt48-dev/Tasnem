package com.tasneem.athkar;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** يعيد تشغيل خدمة الأذكار بعد إعادة تشغيل الهاتف أو بعد تحديث التطبيق. */
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context ctx, Intent intent) {
        Intent svc = new Intent(ctx, DhikrService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(svc);
        else ctx.startService(svc);
    }
}
