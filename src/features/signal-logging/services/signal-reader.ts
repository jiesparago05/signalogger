import { NativeModules } from 'react-native';
import { SignalData, ConnectionData, NetworkType, Carrier } from '../../../types/signal';

const { SignalModule } = NativeModules;

export interface RawSignalReading {
  carrier: Carrier;
  networkType: NetworkType;
  signal: SignalData;
  connection: ConnectionData;
}

export async function readSignal(): Promise<RawSignalReading> {
  try {
    const raw = await SignalModule.getSignalInfo();
    return {
      carrier: normalizeCarrier(raw.carrier || 'Unknown') as Carrier,
      networkType: normalizeNetworkType(raw.networkType),
      signal: {
        // Phase 1 real-connectivity capture — forwarded as-is from the native module.
        // validated/downKbps/upKbps/dataState may be undefined on very old native builds.
        validated: typeof raw.validated === 'boolean' ? raw.validated : undefined,
        downKbps: typeof raw.downKbps === 'number' ? raw.downKbps : undefined,
        upKbps: typeof raw.upKbps === 'number' ? raw.upKbps : undefined,
        dataState: raw.dataState,
        dbm: raw.dbm ?? -999,
        rssi: raw.rssi,
        snr: raw.snr,
        cellId: raw.cellId,
        bandFrequency: raw.bandFrequency,
      },
      connection: {
        isWifi: raw.isWifi ?? false,
        downloadSpeed: raw.downloadSpeed,
        uploadSpeed: raw.uploadSpeed,
        ping: raw.ping,
      },
    };
  } catch (error) {
    console.warn('Failed to read signal:', error);
    return {
      carrier: 'Unknown' as Carrier,
      networkType: 'none',
      signal: { dbm: -999 },
      connection: { isWifi: false },
    };
  }
}

function normalizeCarrier(raw: string): string {
  if (!raw) return 'Unknown';
  const s = raw.toLowerCase();
  // Keyword-based detection — handles variants like "SMART Prepaid", "Smart LTE",
  // "Globe Telecom", "TNT Prepaid", etc. Order matters: check TNT/GOMO/Sun before
  // Smart/Globe since they are sub-brands of Smart/Globe respectively.
  if (s.includes('talk') && s.includes('text')) return 'TNT';
  if (s.includes('tnt')) return 'TNT';
  if (s.includes('gomo')) return 'GOMO';
  if (s.includes('sun')) return 'Sun';
  if (s.includes('dito')) return 'DITO';
  if (s.includes('smart')) return 'Smart';
  if (s.includes('globe')) return 'Globe';
  return raw;
}

function normalizeNetworkType(raw: string | number): NetworkType {
  const typeMap: Record<string, NetworkType> = {
    GPRS: '2G',
    EDGE: '2G',
    CDMA: '2G',
    '1xRTT': '2G',
    IDEN: '2G',
    UMTS: '3G',
    EVDO_0: '3G',
    EVDO_A: '3G',
    HSDPA: '3G',
    HSUPA: '3G',
    HSPA: '3G',
    EVDO_B: '3G',
    EHRPD: '3G',
    HSPAP: '3G',
    LTE: '4G',
    NR: '5G',
    '2G': '2G',
    '3G': '3G',
    '4G': '4G',
    '5G': '5G',
  };
  return typeMap[String(raw)] || 'none';
}
