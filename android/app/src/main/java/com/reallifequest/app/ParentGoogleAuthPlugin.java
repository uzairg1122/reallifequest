package com.reallifequest.app;

import android.os.CancellationSignal;
import android.util.Log;
import androidx.credentials.CredentialManager;
import androidx.core.content.ContextCompat;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ParentGoogleAuth")
public class ParentGoogleAuthPlugin extends Plugin {
    private CancellationSignal cancellation;

    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = call.getString("clientId", "");
        String nonce = call.getString("nonce", "");
        if (clientId.isEmpty() || nonce.isEmpty()) { call.reject("Google login is not configured."); return; }
        if (cancellation != null) { call.reject("Google sign-in is already open."); return; }
        getActivity().runOnUiThread(() -> {
            cancellation = new CancellationSignal();
            GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(clientId).setNonce(nonce).build();
            GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
            CredentialManager.create(getContext()).getCredentialAsync(getActivity(), request, cancellation,
                ContextCompat.getMainExecutor(getContext()), new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override public void onResult(GetCredentialResponse response) {
                        cancellation = null;
                        try {
                            if (!(response.getCredential() instanceof CustomCredential)) {
                                call.reject("Google returned an unsupported credential."); return;
                            }
                            GoogleIdTokenCredential token = GoogleIdTokenCredential.createFrom(response.getCredential().getData());
                            JSObject result = new JSObject(); result.put("idToken", token.getIdToken()); call.resolve(result);
                        } catch (Exception error) { call.reject("Could not read the Google credential. Please try again."); }
                    }
                    @Override public void onError(GetCredentialException error) {
                        cancellation = null;
                        // Record only the error category, never credentials or account details.
                        Log.w("RLQGoogleAuth", "Credential request failed: " + error.getClass().getSimpleName() + " / " + error.getType());
                        if (error instanceof GetCredentialCancellationException) call.reject("Sign-in cancelled.", "CANCELLED");
                        else call.reject("Google sign-in could not finish. Check your internet and that your Google account is added in Android Settings, then try again.", "GOOGLE_CREDENTIAL_ERROR");
                    }
                });
        });
    }

    @Override protected void handleOnDestroy() {
        if (cancellation != null) { cancellation.cancel(); cancellation = null; }
    }
}
