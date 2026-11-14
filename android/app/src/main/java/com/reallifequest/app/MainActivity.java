package com.reallifequest.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.content.pm.ApplicationInfo;
import androidx.activity.OnBackPressedCallback;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ParentGoogleAuthPlugin.class);
        registerPlugin(NavigationPlugin.class);
        registerPlugin(SessionVaultPlugin.class);
        registerPlugin(QuestNotificationsPlugin.class);
        registerPlugin(FamilyBillingPlugin.class);
        super.onCreate(savedInstanceState);
        // Debug emulator talks to the developer's local PHP server over HTTP.
        // Release builds retain the default mixed-content restrictions.
        if (getBridge()!=null && (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (getBridge() != null) getBridge().triggerWindowJSEvent("rlq-native-back");
            }
        });
    }
    @Override public void onResume(){super.onResume();QuestNotificationCenter.foreground=true;}
    @Override public void onPause(){QuestNotificationCenter.foreground=false;super.onPause();}
    @Override protected void onNewIntent(android.content.Intent intent){super.onNewIntent(intent);setIntent(intent);if(getBridge()!=null&&(intent.getBooleanExtra("rlq_notification",false)||intent.hasExtra("notificationId")))getBridge().triggerWindowJSEvent("rlq-push-open");}
}
