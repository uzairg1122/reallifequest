package com.reallifequest.app;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.getcapacitor.JSObject;
public class QuestMessagingService extends FirebaseMessagingService {
 @Override public void onMessageReceived(RemoteMessage message){QuestNotificationCenter.receive(this,message.getData());}
 @Override public void onNewToken(String token){
  // Token is not an app bearer token. Send it only to the authenticated Hostinger registration route.
  JSObject event=new JSObject();event.put("token",token);QuestNotificationsPlugin.tokenChanged(event);
  String previous=QuestNotificationCenter.prefs(this).getString("registered_token","");
  if(previous.isEmpty()||previous.equals(token)||QuestNotificationCenter.owner(this).isEmpty()||!QuestNotificationCenter.enabled(this))return;
  String base=getString(R.string.rlq_push_api_base);if(!base.startsWith("https://"))return;
  try{
   java.net.HttpURLConnection connection=(java.net.HttpURLConnection)new java.net.URL(base.replaceAll("/$","")+"/notifications/refresh-device").openConnection();connection.setRequestMethod("POST");connection.setConnectTimeout(3000);connection.setReadTimeout(5000);connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
   JSObject input=new JSObject();input.put("installationId",QuestNotificationCenter.installation(this));input.put("previousToken",previous);input.put("token",token);
   try(java.io.OutputStream output=connection.getOutputStream()){output.write(input.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}
   if(connection.getResponseCode()==200)QuestNotificationCenter.prefs(this).edit().putString("registered_token",token).apply();connection.disconnect();
  }catch(Exception ignored){/* App-open registration repairs a failed background refresh. */}
 }
}
