package com.reallifequest.app;

import com.android.billingclient.api.*;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;
import java.util.List;
import android.provider.Settings;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@CapacitorPlugin(name = "FamilyBilling")
public class FamilyBillingPlugin extends Plugin {
    @PluginMethod public void trialDevice(PluginCall call) {
        String id = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
        if (id == null || id.isEmpty()) {
            call.reject("Could not identify this Android device.");
            return;
        }
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                .digest(("reallifequest-trial:" + id).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(64);
            for (byte value : hash) hex.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
            JSObject result = new JSObject();
            result.put("hash", hex.toString());
            call.resolve(result);
        } catch (java.security.NoSuchAlgorithmException error) {
            call.reject("Could not identify this Android device.");
        }
    }
    private static final String PRODUCT = "family_access";
    private BillingClient client;
    private PluginCall checkout;

    @Override public void load() {
        client = BillingClient.newBuilder(getContext())
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .setListener(this::purchaseUpdated)
            .build();
    }

    private void ready(PluginCall call, Runnable action) {
        if (client.isReady()) {
            action.run();
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) action.run();
                else call.reject("Google Play Billing is unavailable. Try again from Google Play.");
            }
            @Override public void onBillingServiceDisconnected() {}
        });
    }

    private void products(PluginCall call, java.util.function.Consumer<ProductDetails> action) {
        ready(call, () -> client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT).setProductType(BillingClient.ProductType.SUBS).build())).build(),
            (result, details) -> {
                List<ProductDetails> items = details.getProductDetailsList();
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || items.isEmpty()) {
                    call.reject("Subscription plans are unavailable for this Google Play account.");
                    return;
                }
                action.accept(items.get(0));
            }));
    }

    @PluginMethod public void plans(PluginCall call) {
        products(call, details -> {
            JSArray plans = new JSArray();
            for (ProductDetails.SubscriptionOfferDetails offer : details.getSubscriptionOfferDetails()) {
                if (offer.getOfferId() != null) continue;
                List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
                if (phases.isEmpty()) continue;
                JSObject plan = new JSObject();
                plan.put("id", offer.getBasePlanId());
                plan.put("price", phases.get(0).getFormattedPrice());
                plans.put(plan);
            }
            JSObject response = new JSObject();
            response.put("plans", plans);
            call.resolve(response);
        });
    }

    @PluginMethod public void buy(PluginCall call) {
        String account = call.getString("accountId", "");
        if (!account.matches("[0-9a-f]{64}")) {
            call.reject("Invalid family account.");
            return;
        }
        products(call, details -> getActivity().runOnUiThread(() -> {
            if (checkout != null) {
                call.reject("A Google Play purchase is already in progress.");
                return;
            }
            for (ProductDetails.SubscriptionOfferDetails offer : details.getSubscriptionOfferDetails()) {
                if (offer.getOfferId() != null || !offer.getBasePlanId().equals(call.getString("planId"))) continue;
                BillingFlowParams.ProductDetailsParams product = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details).setOfferToken(offer.getOfferToken()).build();
                checkout = call;
                BillingResult result = client.launchBillingFlow(getActivity(), BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(product)).setObfuscatedAccountId(account).build());
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) purchaseUpdated(result, null);
                return;
            }
            call.reject("This plan is unavailable.");
        }));
    }

    @PluginMethod public void restore(PluginCall call) {
        ready(call, () -> client.queryPurchasesAsync(QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS).build(), (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("Could not check Google Play purchases.");
                    return;
                }
                resolvePurchases(call, purchases);
            }));
    }

    private void purchaseUpdated(BillingResult result, List<Purchase> purchases) {
        PluginCall call = checkout;
        checkout = null;
        if (call == null) return;
        if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            call.reject("Purchase cancelled.");
        } else if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null) {
            call.reject("Google Play could not complete the purchase. Try Restore purchase if you already paid.");
        } else {
            resolvePurchases(call, purchases);
        }
    }

    private void resolvePurchases(PluginCall call, List<Purchase> purchases) {
        JSArray tokens = new JSArray();
        boolean pending = false;
        for (Purchase purchase : purchases) {
            if (!purchase.getProducts().contains(PRODUCT)) continue;
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) tokens.put(purchase.getPurchaseToken());
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
        }
        JSObject response = new JSObject();
        response.put("tokens", tokens);
        response.put("pending", pending);
        call.resolve(response);
    }

    @Override protected void handleOnDestroy() {
        if (client != null) client.endConnection();
        super.handleOnDestroy();
    }
}
