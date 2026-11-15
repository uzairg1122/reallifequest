package com.reallifequest.app;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import android.content.Intent;
import android.content.ClipData;
import android.content.ContentValues;
import android.app.Activity;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.annotation.ActivityCallback;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
@CapacitorPlugin(name="QuestNavigation")
public class NavigationPlugin extends Plugin {
 private static final String PROGRESS_FILE = "real-life-quest-progress.png";

 @PluginMethod public void shareText(PluginCall call) {
  String text = call.getString("text", "");
  if (text.trim().isEmpty()) {
   call.reject("Share text is required.");
   return;
  }
  Intent intent = new Intent(Intent.ACTION_SEND).setType("text/plain")
      .putExtra(Intent.EXTRA_TEXT, text);
  getActivity().runOnUiThread(() -> {
   try {
    getActivity().startActivity(Intent.createChooser(intent, null));
    call.resolve();
   } catch (RuntimeException error) {
    call.reject("Could not open Android sharing.");
   }
  });
 }

 private byte[] progressPng(PluginCall call) throws IOException {
  String encoded = call.getString("data", "");
  if (encoded.length() > 8_000_000) throw new IOException("Image is too large");
  byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
  byte[] signature = {(byte) 137, 80, 78, 71, 13, 10, 26, 10};
  if (bytes.length < signature.length) throw new IOException("Empty image");
  for (int i = 0; i < signature.length; i++) {
   if (bytes[i] != signature[i]) throw new IOException("Invalid PNG");
  }
  return bytes;
 }

 @PluginMethod public void shareImage(PluginCall call) {
  try {
   byte[] bytes = progressPng(call);
   File folder = new File(getContext().getCacheDir(), "progress-cards");
   if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Cache unavailable");
   File[] previous = folder.listFiles();
   if (previous != null) {
    long cutoff = System.currentTimeMillis() - 86_400_000L;
    for (File old : previous) if (old.lastModified() < cutoff) old.delete();
   }
   File file = File.createTempFile("real-life-quest-", ".png", folder);
   try (FileOutputStream output = new FileOutputStream(file)) { output.write(bytes); }
   Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
   Intent intent = new Intent(Intent.ACTION_SEND).setType("image/png")
       .putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
   intent.setClipData(ClipData.newRawUri("Super Tasker", uri));
   getActivity().runOnUiThread(() -> {
    try {
     getActivity().startActivity(Intent.createChooser(intent, null));
     call.resolve();
    } catch (RuntimeException error) {
     call.reject("Could not open Android sharing.");
    }
   });
  } catch (Exception error) {
   call.reject("Could not prepare your share image.");
  }
 }

 @PluginMethod public void saveImage(PluginCall call) {
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
   Intent picker = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
       .setType("image/png").putExtra(Intent.EXTRA_TITLE, PROGRESS_FILE);
   startActivityForResult(call, picker, "imageLocationPicked");
   return;
  }
  Uri uri = null;
  var resolver = getContext().getContentResolver();
  try {
   byte[] bytes = progressPng(call);
   ContentValues values = new ContentValues();
   values.put(MediaStore.Images.Media.DISPLAY_NAME, PROGRESS_FILE);
   values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
   values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Super Tasker");
   values.put(MediaStore.Images.Media.IS_PENDING, 1);
   uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
   if (uri == null) throw new IOException("Gallery unavailable");
   writePng(uri, bytes);
   values.clear();
   values.put(MediaStore.Images.Media.IS_PENDING, 0);
   if (resolver.update(uri, values, null, null) == 0) throw new IOException("Could not publish image");
   call.resolve(new JSObject().put("saved", true).put("gallery", true));
  } catch (Exception error) {
   if (uri != null) {
    try { resolver.delete(uri, null, null); } catch (RuntimeException ignored) {}
   }
   call.reject("Could not save your image to the gallery.");
  }
 }

 @ActivityCallback private void imageLocationPicked(PluginCall call, ActivityResult result) {
  if (call == null) return;
  Intent data = result.getData();
  if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
   call.resolve(new JSObject().put("saved", false));
   return;
  }
  try {
   writePng(data.getData(), progressPng(call));
   call.resolve(new JSObject().put("saved", true));
  } catch (Exception error) {
   call.reject("Could not write the image to the selected folder.");
  }
 }

 private void writePng(Uri uri, byte[] bytes) throws IOException {
  try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
   if (output == null) throw new IOException("Image location unavailable");
   output.write(bytes);
  }
 }

 @PluginMethod public void exportJson(PluginCall call){
  String text=call.getString("data","");String name=call.getString("name","real-life-quest.json").replaceAll("[^A-Za-z0-9._-]","-");
  if(!name.endsWith(".json")){call.reject("Choose a JSON filename.");return;}
  try{File folder=new File(getContext().getCacheDir(),"exports");if(!folder.exists()&&!folder.mkdirs())throw new Exception("Cache unavailable");File file=new File(folder,name);
   try(FileOutputStream output=new FileOutputStream(file)){output.write(text.getBytes(StandardCharsets.UTF_8));}
   Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",file);
   Intent intent=new Intent(Intent.ACTION_SEND).setType("application/json").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
   getActivity().runOnUiThread(()->{getActivity().startActivity(Intent.createChooser(intent,"Save your family data"));call.resolve();});
  }catch(Exception error){call.reject("Could not prepare the export. Please contact support.");}
 }
 private String validLink(Intent intent){
  Uri uri=intent==null?null:intent.getData();
  String host=getContext().getString(R.string.rlq_app_link_host);
  return uri!=null&&"https".equals(uri.getScheme())&&host.equals(uri.getHost())&&("/real-life-quest".equals(uri.getPath())||"/real-life-quest/".equals(uri.getPath()))?uri.toString():null;
 }
 @PluginMethod public void launchUrl(PluginCall call){JSObject result=new JSObject();result.put("url",validLink(getActivity().getIntent()));call.resolve(result);}
 @Override protected void handleOnNewIntent(Intent intent){String url=validLink(intent);if(url!=null){JSObject data=new JSObject();data.put("url",url);bridge.triggerWindowJSEvent("rlq-open-link",data.toString());}}
 @PluginMethod public void background(PluginCall call) {
  getActivity().runOnUiThread(()->{getActivity().moveTaskToBack(true);call.resolve();});
 }
}
