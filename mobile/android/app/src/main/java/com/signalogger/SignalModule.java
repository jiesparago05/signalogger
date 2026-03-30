package com.signalogger;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.telephony.CellInfo;
import android.telephony.CellInfoLte;
import android.telephony.CellInfoNr;
import android.telephony.CellInfoGsm;
import android.telephony.CellInfoWcdma;
import android.telephony.CellSignalStrengthLte;
import android.telephony.CellSignalStrengthNr;
import android.telephony.TelephonyManager;

import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.util.List;

public class SignalModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public SignalModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "SignalModule";
    }

    @ReactMethod
    public void getSignalInfo(Promise promise) {
        try {
            WritableMap result = Arguments.createMap();

            TelephonyManager tm = (TelephonyManager)
                    reactContext.getSystemService(Context.TELEPHONY_SERVICE);

            if (tm == null) {
                promise.reject("ERROR", "TelephonyManager not available");
                return;
            }

            // Carrier name
            String carrier = tm.getNetworkOperatorName();
            result.putString("carrier", carrier != null ? carrier : "Unknown");

            // Network type
            String networkType = getNetworkType(tm);
            result.putString("networkType", networkType);

            // WiFi check
            boolean isWifi = isWifiConnected();
            result.putBoolean("isWifi", isWifi);

            // Signal strength from CellInfo
            if (ContextCompat.checkSelfPermission(reactContext,
                    Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {

                List<CellInfo> cellInfoList = tm.getAllCellInfo();
                if (cellInfoList != null && !cellInfoList.isEmpty()) {
                    for (CellInfo cellInfo : cellInfoList) {
                        if (!cellInfo.isRegistered()) continue;

                        if (cellInfo instanceof CellInfoLte) {
                            CellInfoLte lte = (CellInfoLte) cellInfo;
                            CellSignalStrengthLte ss = lte.getCellSignalStrength();
                            result.putInt("dbm", ss.getDbm());
                            result.putInt("rssi", ss.getRssi());
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                result.putInt("rssnr", ss.getRssnr());
                            }
                            result.putString("cellId",
                                    String.valueOf(lte.getCellIdentity().getCi()));
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                                result.putInt("bandFrequency",
                                        lte.getCellIdentity().getEarfcn());
                            }
                            break;
                        }

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                                && cellInfo instanceof CellInfoNr) {
                            CellInfoNr nr = (CellInfoNr) cellInfo;
                            CellSignalStrengthNr ss =
                                    (CellSignalStrengthNr) nr.getCellSignalStrength();
                            result.putInt("dbm", ss.getDbm());
                            result.putInt("snr", ss.getCsiSinr());
                            break;
                        }

                        if (cellInfo instanceof CellInfoGsm) {
                            result.putInt("dbm",
                                    ((CellInfoGsm) cellInfo).getCellSignalStrength().getDbm());
                            break;
                        }

                        if (cellInfo instanceof CellInfoWcdma) {
                            result.putInt("dbm",
                                    ((CellInfoWcdma) cellInfo).getCellSignalStrength().getDbm());
                            break;
                        }
                    }
                }
            }

            // Default dbm if not set
            if (!result.hasKey("dbm")) {
                result.putInt("dbm", -999);
            }

            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    private String getNetworkType(TelephonyManager tm) {
        if (ContextCompat.checkSelfPermission(reactContext,
                Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            return "none";
        }

        int type;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            type = tm.getDataNetworkType();
        } else {
            type = tm.getNetworkType();
        }

        switch (type) {
            case TelephonyManager.NETWORK_TYPE_GPRS:
            case TelephonyManager.NETWORK_TYPE_EDGE:
            case TelephonyManager.NETWORK_TYPE_CDMA:
            case TelephonyManager.NETWORK_TYPE_1xRTT:
            case TelephonyManager.NETWORK_TYPE_IDEN:
                return "2G";
            case TelephonyManager.NETWORK_TYPE_UMTS:
            case TelephonyManager.NETWORK_TYPE_EVDO_0:
            case TelephonyManager.NETWORK_TYPE_EVDO_A:
            case TelephonyManager.NETWORK_TYPE_HSDPA:
            case TelephonyManager.NETWORK_TYPE_HSUPA:
            case TelephonyManager.NETWORK_TYPE_HSPA:
            case TelephonyManager.NETWORK_TYPE_EVDO_B:
            case TelephonyManager.NETWORK_TYPE_EHRPD:
            case TelephonyManager.NETWORK_TYPE_HSPAP:
                return "3G";
            case TelephonyManager.NETWORK_TYPE_LTE:
                return "4G";
            case TelephonyManager.NETWORK_TYPE_NR:
                return "5G";
            default:
                return "none";
        }
    }

    private boolean isWifiConnected() {
        ConnectivityManager cm = (ConnectivityManager)
                reactContext.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
            return nc != null && nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
        }
        return false;
    }
}
