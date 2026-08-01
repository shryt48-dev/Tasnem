// android/app/src/main/java/com/tasneem/athkar/MainActivity.java
package com.tasneem.athkar;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // تسجيل الإضافة المحلية قبل استدعاء super
        registerPlugin(TasneemPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
