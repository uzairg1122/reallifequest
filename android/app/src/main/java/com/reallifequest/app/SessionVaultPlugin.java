package com.reallifequest.app;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name="SessionVault")
public class SessionVaultPlugin extends Plugin {
 private static final String ALIAS="rlq_session_v1";
 private SecretKey key() throws Exception {
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
  if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
  KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
  generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
  return generator.generateKey();
 }
 private String name(PluginCall call){String name=call.getString("key","");return name.matches("[a-z_]{1,40}")?name:null;}
 @PluginMethod public synchronized void get(PluginCall call){
  String name=name(call);if(name==null){call.reject("Invalid secure storage key.");return;}
  try{String saved=getContext().getSharedPreferences("rlq_vault",Context.MODE_PRIVATE).getString(name,null);JSObject result=new JSObject();
   if(saved!=null){String[] parts=saved.split(":",2);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));result.put("value",new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8));}
   call.resolve(result);
  }catch(Exception error){call.reject("Saved sign-in could not be unlocked. Please retry; your family data is still on the server.");}
 }
 @PluginMethod public synchronized void set(PluginCall call){
  String name=name(call);if(name==null){call.reject("Invalid secure storage key.");return;}
  try{String value=call.getString("value","");Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));String saved=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
   if(!getContext().getSharedPreferences("rlq_vault",Context.MODE_PRIVATE).edit().putString(name,saved).commit())throw new Exception();call.resolve();
  }catch(Exception error){call.reject("Could not save secure sign-in. Please free device storage and retry.");}
 }
}
