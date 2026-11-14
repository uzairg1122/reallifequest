package com.reallifequest.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.ref.WeakReference;

@CapacitorPlugin(name="QuestNotifications",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class QuestNotificationsPlugin extends Plugin {
 private static WeakReference<QuestNotificationsPlugin> active=new WeakReference<>(null);
 private String importingOwner="";
 @Override public void load(){active=new WeakReference<>(this);}
 static void deliver(JSObject event){QuestNotificationsPlugin plugin=active.get();if(plugin!=null)plugin.notifyListeners("received",event);}
 static void tokenChanged(JSObject event){QuestNotificationsPlugin plugin=active.get();if(plugin!=null)plugin.notifyListeners("tokenChanged",event);}
 @PluginMethod public void bind(PluginCall call){
  String user=call.getString("userId",""),session=call.getString("sessionHash","");
  if(!user.matches("[A-Za-z0-9-]{1,64}")||!session.matches("[a-f0-9]{64}")){call.reject("Invalid notification account.");return;}
  boolean changed=!user.equals(QuestNotificationCenter.owner(getContext()))||!session.equals(QuestNotificationCenter.prefs(getContext()).getString("session",""));
  if(changed){NotificationManagerCompat.from(getContext()).cancelAll();QuestNotificationCenter.stop();QuestNotificationCenter.retireChannels(getContext());}
  QuestNotificationCenter.prefs(getContext()).edit().putString("owner",user).putString("session",session).apply();
  // Default to automatic alerts once Android permission has been granted; explicit Off is retained.
  if(!QuestNotificationCenter.prefs(getContext()).contains(QuestNotificationCenter.key(getContext(),"enabled"))&&NotificationManagerCompat.from(getContext()).areNotificationsEnabled())QuestNotificationCenter.prefs(getContext()).edit().putBoolean(QuestNotificationCenter.key(getContext(),"enabled"),true).apply();
  call.resolve(QuestNotificationCenter.status(getContext()));
 }
 @PluginMethod public void status(PluginCall call){call.resolve(QuestNotificationCenter.status(getContext()));}
 private boolean showNotice(String id,String type,String title,String body){java.util.Map<String,String> data=new java.util.HashMap<>();data.put("userId",QuestNotificationCenter.owner(getContext()));data.put("sessionHash",QuestNotificationCenter.prefs(getContext()).getString("session",""));data.put("notificationId",id);data.put("type",type);data.put("title",title);data.put("body",body);return QuestNotificationCenter.present(getContext(),data,false);}
 @PluginMethod public void show(PluginCall call){JSObject result=new JSObject();result.put("handled",showNotice(call.getString("id",""),call.getString("type",""),call.getString("title","Family update"),call.getString("body","Open Real Life Quest for your update.")));call.resolve(result);}
 @PluginMethod public void test(PluginCall call){JSObject result=new JSObject();result.put("handled",showNotice(java.util.UUID.randomUUID().toString(),"test","Real Life Quest notification test","Phone tray alerts are ready. This is a local test, not a Firebase delivery test."));call.resolve(result);}
 @PluginMethod public void opened(PluginCall call){JSObject r=new JSObject();r.put("opened",QuestNotificationCenter.consumeIntent(getContext(),getActivity().getIntent()));call.resolve(r);}
 @PluginMethod public void registered(PluginCall call){String token=call.getString("token","");String session=call.getString("sessionHash","");if(session.equals(QuestNotificationCenter.prefs(getContext()).getString("session",""))&&token.length()>=40)QuestNotificationCenter.prefs(getContext()).edit().putString("registered_token",token).apply();call.resolve();}
 @PluginMethod public void disconnect(PluginCall call){QuestNotificationCenter.retireChannels(getContext());QuestNotificationCenter.prefs(getContext()).edit().remove("owner").remove("session").apply();NotificationManagerCompat.from(getContext()).cancelAll();QuestNotificationCenter.stop();call.resolve();}
 @PluginMethod public void token(PluginCall call){
  try{FirebaseMessaging.getInstance().setAutoInitEnabled(true);FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task->{if(!task.isSuccessful()){call.reject("Could not connect phone notifications. Check Google Play services and internet.");return;}JSObject result=QuestNotificationCenter.status(getContext());result.put("token",task.getResult());call.resolve(result);});}
  catch(Exception e){call.reject("Firebase notification configuration is missing.");}
 }
 @PluginMethod public void enable(PluginCall call){
  if(QuestNotificationCenter.owner(getContext()).isEmpty()){call.reject("Sign in before enabling notifications.");return;}
  if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=com.getcapacitor.PermissionState.GRANTED){requestPermissionForAlias("notifications",call,"permissionResult");return;}
  enabled(call);
 }
 @PermissionCallback private void permissionResult(PluginCall call){enabled(call);}
 private void enabled(PluginCall call){boolean granted=NotificationManagerCompat.from(getContext()).areNotificationsEnabled();QuestNotificationCenter.prefs(getContext()).edit().putBoolean(QuestNotificationCenter.key(getContext(),"enabled"),granted).apply();if(granted)QuestNotificationCenter.channel(getContext());call.resolve(QuestNotificationCenter.status(getContext()));}
 @PluginMethod public void disable(PluginCall call){QuestNotificationCenter.prefs(getContext()).edit().putBoolean(QuestNotificationCenter.key(getContext(),"enabled"),false).apply();QuestNotificationCenter.retireChannels(getContext());NotificationManagerCompat.from(getContext()).cancelAll();call.resolve(QuestNotificationCenter.status(getContext()));}
 @PluginMethod public void setSound(PluginCall call){String value=call.getString("sound","");if(!java.util.Arrays.asList("default","gentle","bright","soft","silent","custom").contains(value)){call.reject("Unknown notification sound.");return;}if(value.equals("custom")&&QuestNotificationCenter.prefs(getContext()).getString(QuestNotificationCenter.key(getContext(),"custom_uri"),"").isEmpty()){call.reject("Choose an audio file first.");return;}QuestNotificationCenter.prefs(getContext()).edit().putString(QuestNotificationCenter.key(getContext(),"sound"),value).apply();QuestNotificationCenter.channel(getContext());call.resolve(QuestNotificationCenter.status(getContext()));}
 @PluginMethod public void preview(PluginCall call){QuestNotificationCenter.preview(getContext());call.resolve();}
 @PluginMethod public void systemSettings(PluginCall call){Intent intent=new Intent(Build.VERSION.SDK_INT>=26?Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS:Settings.ACTION_APP_NOTIFICATION_SETTINGS);intent.putExtra(Settings.EXTRA_APP_PACKAGE,getContext().getPackageName());if(Build.VERSION.SDK_INT>=26)intent.putExtra(Settings.EXTRA_CHANNEL_ID,QuestNotificationCenter.channel(getContext()));getActivity().startActivity(intent);call.resolve();}
 @PluginMethod public void importSound(PluginCall call){
  if(Build.VERSION.SDK_INT<29){call.reject("Use Android sound settings to add an audio file on this Android version.");return;}
  importingOwner=QuestNotificationCenter.owner(getContext());
  Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("audio/*").addCategory(Intent.CATEGORY_OPENABLE);
  startActivityForResult(call,picker,"audioPicked");
 }
 @ActivityCallback private void audioPicked(PluginCall call,ActivityResult result){
  if(call==null)return;
  if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){JSObject value=QuestNotificationCenter.status(getContext());value.put("cancelled",true);call.resolve(value);return;}
  if(!importingOwner.equals(QuestNotificationCenter.owner(getContext()))){call.reject("Account changed. Choose the sound again.");return;}
  Uri source=result.getData().getData();if(source==null){call.reject("No audio selected.");return;}
  getBridge().execute(()->{
   Uri saved=null;
   try{
    String mime=getContext().getContentResolver().getType(source);if(mime==null||!mime.startsWith("audio/"))throw new Exception("Choose an MP3, WAV, OGG or M4A audio file.");
    String name="Custom sound";try(android.database.Cursor cursor=getContext().getContentResolver().query(source,new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null)){if(cursor!=null&&cursor.moveToFirst()){name=cursor.getString(0);if(!cursor.isNull(1)&&cursor.getLong(1)>5*1024*1024)throw new Exception("Choose an audio file smaller than 5 MB.");}}
    MediaMetadataRetriever metadata=new MediaMetadataRetriever();long duration;try{metadata.setDataSource(getContext(),source);duration=Long.parseLong(metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));}finally{metadata.release();}
    if(duration<=0||duration>30000)throw new Exception("Choose a short notification sound, up to 30 seconds.");
    ContentValues values=new ContentValues();values.put(MediaStore.Audio.Media.DISPLAY_NAME,"RLQ-"+java.util.UUID.randomUUID()+"-"+name);values.put(MediaStore.Audio.Media.MIME_TYPE,mime);values.put(MediaStore.Audio.Media.RELATIVE_PATH,"Notifications/RealLifeQuest");values.put(MediaStore.Audio.Media.IS_NOTIFICATION,1);values.put(MediaStore.Audio.Media.IS_PENDING,1);
    saved=getContext().getContentResolver().insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,values);if(saved==null)throw new Exception("Could not save sound.");
    try(InputStream input=getContext().getContentResolver().openInputStream(source);OutputStream output=getContext().getContentResolver().openOutputStream(saved)){if(input==null||output==null)throw new Exception("Could not read audio.");byte[] buffer=new byte[8192];int count,total=0;while((count=input.read(buffer))!=-1){total+=count;if(total>5*1024*1024)throw new Exception("Choose an audio file smaller than 5 MB.");output.write(buffer,0,count);}}
    values.clear();values.put(MediaStore.Audio.Media.IS_PENDING,0);getContext().getContentResolver().update(saved,values,null,null);
    if(!importingOwner.equals(QuestNotificationCenter.owner(getContext())))throw new Exception("Account changed. Choose the sound again.");
    QuestNotificationCenter.prefs(getContext()).edit().putString(QuestNotificationCenter.key(getContext(),"custom_uri"),saved.toString()).putString(QuestNotificationCenter.key(getContext(),"custom_name"),name).putString(QuestNotificationCenter.key(getContext(),"sound"),"custom").apply();QuestNotificationCenter.channel(getContext());call.resolve(QuestNotificationCenter.status(getContext()));
   }catch(Exception error){if(saved!=null)getContext().getContentResolver().delete(saved,null,null);call.reject(error.getMessage()==null?"Could not import audio.":error.getMessage());}
  });
 }
}
