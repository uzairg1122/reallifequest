package com.reallifequest.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

final class QuestNotificationCenter {
 static volatile boolean foreground=false;
 private static Ringtone preview;
 static SharedPreferences prefs(Context c){return c.getSharedPreferences("rlq_notifications",Context.MODE_PRIVATE);}
 static String digest(String value){try{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format("%02x",b));return s.toString();}catch(Exception e){throw new IllegalStateException(e);}}
 static String owner(Context c){return prefs(c).getString("owner","");}
 static String key(Context c,String suffix){return digest(owner(c)).substring(0,20)+"_"+suffix;}
 static boolean enabled(Context c){return prefs(c).getBoolean(key(c,"enabled"),false);}
 static String sound(Context c){return prefs(c).getString(key(c,"sound"),"gentle");}
 static Uri soundUri(Context c){
  String selected=sound(c);
  if(selected.equals("silent"))return null;
  if(selected.equals("default"))return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
  if(selected.equals("custom")){String uri=prefs(c).getString(key(c,"custom_uri"),"");if(!uri.isEmpty())return Uri.parse(uri);}
  int resource=selected.equals("bright")?R.raw.quest_bright:selected.equals("soft")?R.raw.quest_soft:R.raw.quest_gentle;
  return Uri.parse("android.resource://"+c.getPackageName()+"/raw/"+c.getResources().getResourceEntryName(resource));
 }
 static String channel(Context c){
  String soundKey=sound(c)+"|"+prefs(c).getString(key(c,"custom_uri"),"");
  String id="rlq_"+digest(owner(c)+"|"+prefs(c).getString("session","")+"|"+soundKey).substring(0,24);
  if(Build.VERSION.SDK_INT>=26){NotificationManager manager=c.getSystemService(NotificationManager.class);
   if(manager.getNotificationChannel("rlq_inactive")==null)manager.createNotificationChannel(new NotificationChannel("rlq_inactive","Inactive account",NotificationManager.IMPORTANCE_NONE));
   if(manager.getNotificationChannel(id)==null){NotificationChannel channel=new NotificationChannel(id,"Family updates · "+sound(c),NotificationManager.IMPORTANCE_HIGH);channel.setDescription("Missions, approvals and rewards for the signed-in account");channel.setSound(soundUri(c),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());channel.enableVibration(true);manager.createNotificationChannel(channel);}
  }
  java.util.Set<String> channels=new java.util.HashSet<>(prefs(c).getStringSet("active_channels",java.util.Collections.emptySet()));channels.add(id);prefs(c).edit().putStringSet("active_channels",channels).apply();
  return id;
 }
 static void retireChannels(Context c){
  if(Build.VERSION.SDK_INT>=26){NotificationManager manager=c.getSystemService(NotificationManager.class);for(String id:prefs(c).getStringSet("active_channels",java.util.Collections.emptySet()))manager.deleteNotificationChannel(id);if(manager.getNotificationChannel("rlq_inactive")==null)manager.createNotificationChannel(new NotificationChannel("rlq_inactive","Inactive account",NotificationManager.IMPORTANCE_NONE));}
  prefs(c).edit().remove("active_channels").apply();
 }
 static boolean consumeIntent(Context c,Intent intent){
  if(intent.getBooleanExtra("rlq_notification",false)){intent.removeExtra("rlq_notification");return true;}
  String id=intent.getStringExtra("notificationId"),user=intent.getStringExtra("userId"),session=intent.getStringExtra("sessionHash");
  if(id==null||!id.matches("[a-f0-9-]{36}")||!owner(c).equals(user)||!prefs(c).getString("session","").equals(session))return false;
  intent.removeExtra("notificationId");return true;
 }
 static JSObject status(Context c){JSObject r=new JSObject();r.put("enabled",enabled(c));r.put("permission",NotificationManagerCompat.from(c).areNotificationsEnabled());r.put("sound",sound(c));r.put("customName",prefs(c).getString(key(c,"custom_name"),""));r.put("installationId",installation(c));r.put("channelId",!owner(c).isEmpty()&&enabled(c)?channel(c):"");r.put("needsPermissionPrompt",!owner(c).isEmpty()&&!prefs(c).contains(key(c,"enabled")));return r;}
 static String installation(Context c){SharedPreferences p=prefs(c);String id=p.getString("installation","");if(id.isEmpty()){id=java.util.UUID.randomUUID().toString();p.edit().putString("installation",id).commit();}return id;}
 static void stop(){if(preview!=null){preview.stop();preview=null;}}
 static void preview(Context c){stop();Uri uri=soundUri(c);if(Build.VERSION.SDK_INT>=26){NotificationChannel configured=c.getSystemService(NotificationManager.class).getNotificationChannel(channel(c));if(configured!=null)uri=configured.getSound();}if(uri==null)return;try{preview=RingtoneManager.getRingtone(c,uri);if(preview!=null){preview.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());preview.play();new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(QuestNotificationCenter::stop,5000);}}catch(Exception ignored){}}
 static void receive(Context c,Map<String,String> data){present(c,data,true);}
 static synchronized boolean present(Context c,Map<String,String> data,boolean emit){
  String user=data.getOrDefault("userId",""),session=data.getOrDefault("sessionHash",""),id=data.getOrDefault("notificationId","");SharedPreferences p=prefs(c);
  if(user.isEmpty()||!user.equals(owner(c))||!session.equals(p.getString("session",""))||!enabled(c)||!id.matches("[a-f0-9-]{36}"))return false;
  // Durable dedupe also covers FCM retries after process death.
  String seen=p.getString("seen","");if((","+seen+",").contains(","+id+","))return true;
  JSObject event=new JSObject();event.put("id",id);event.put("type",data.getOrDefault("type",""));event.put("title",data.getOrDefault("title","Family update"));event.put("body",data.getOrDefault("body","Open Real Life Quest for your update."));
  boolean allowed=NotificationManagerCompat.from(c).areNotificationsEnabled();
  if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(c,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)allowed=false;
  String channelId=channel(c);
  if(Build.VERSION.SDK_INT>=26){NotificationChannel configured=c.getSystemService(NotificationManager.class).getNotificationChannel(channelId);if(configured!=null&&configured.getImportance()==NotificationManager.IMPORTANCE_NONE)allowed=false;}
  if(!allowed){event.put("systemAlert",false);if(foreground&&emit)QuestNotificationsPlugin.deliver(event);return false;}
  Intent open=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("rlq_notification",true);
  PendingIntent pending=PendingIntent.getActivity(c,id.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  NotificationCompat.Builder builder=new NotificationCompat.Builder(c,channelId).setSmallIcon(R.drawable.ic_notification).setContentTitle(event.getString("title")).setContentText(event.getString("body")).setContentIntent(pending).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setOnlyAlertOnce(true).setCategory(NotificationCompat.CATEGORY_EVENT);
  builder.setColor(Color.rgb(0,137,153)).setStyle(new NotificationCompat.BigTextStyle().bigText(event.getString("body")));
  if(Build.VERSION.SDK_INT<26)builder.setSound(soundUri(c));
  boolean posted=false;
  try{NotificationManagerCompat.from(c).notify("rlq:"+id,0,builder.build());posted=true;}catch(SecurityException ignored){}
  if(posted){String next=seen.isEmpty()?id:seen+","+id;String[] ids=next.split(",");if(ids.length>100)next=String.join(",",java.util.Arrays.copyOfRange(ids,ids.length-100,ids.length));p.edit().putString("seen",next).apply();}
  event.put("systemAlert",posted);if(foreground&&emit)QuestNotificationsPlugin.deliver(event);
  return posted;
 }
}
